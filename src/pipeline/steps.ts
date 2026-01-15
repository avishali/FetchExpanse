
import { GmailClient } from '../gmail/gmailClient';
import { buildQueries, RecallMode } from '../gmail/gmailQueries';
import { parseMessage } from '../gmail/messageParser';
import { computeExpenseScore } from '../classify/scoring';
import { getDb } from '../db/db';
import { downloadAttachment } from '../gmail/attachmentDownloader';
import { captureToPdfOrScreenshot } from '../evidence/linkCapture';
import { exportEvidence } from '../export/exporter';
import { getDropboxPath } from '../export/pathRules';
import { logger } from '../logging/logger';
import { AnalyzedMessage } from '../evidence/evidenceTypes';
import { sha256 } from '../util/hash';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { getSettings } from '../configStore';
import { GmailLabeler } from '../gmail/gmailLabeler';

const db = getDb();
const gmail = new GmailClient();
import moment from 'moment';
import { DateRange } from '../types/dateRange';
import { resolveVendorName } from '../vendors/vendorResolver';

export interface ScanOptions {
    mock?: boolean;
    limit?: number;
    recall?: RecallMode;
    includeSpam?: boolean;
    includeTrash?: boolean;
}

export async function scanStep(range: DateRange, options: ScanOptions) {
    logger.info(`Starting SCAN step for ${range.label} (Recall: ${options.recall || 'normal'}, Spam: ${options.includeSpam}, Trash: ${options.includeTrash})`);
    
    // In mock mode, we still use simple mock logic for now, or we can update mock to be smarter.
    // To support Phase 14 mock requirement ("Integration test"), let's stick to using GmailScanner even for mock if possible, 
    // but GmailScanner uses `gmail.listMessages` which supports mock.
    
    const { GmailScanner } = require('../gmail/gmailScanner');
    const scanner = new GmailScanner(gmail);

    const generator = scanner.scanGenerator(range, options.recall || 'NORMAL');
    let count = 0;
    
    // Manual iteration to pass feedback (wasInserted) back to generator
    const iterator = generator[Symbol.asyncIterator]();
    let nextVal = await iterator.next();
    
    while (!nextVal.done) {
        if (options.limit && count >= options.limit) break;

        const { msg: msgStub, bucket } = nextVal.value;
        let wasInserted = false;

        // 1. Check if exists
        const exists = db.prepare('SELECT id FROM messages WHERE gmail_message_id = ?').get(msgStub.id);
        
        if (!exists) {
            // 2. Fetch full
            const raw = await gmail.getMessage(msgStub.id, options);
            if (raw) {
                // 3. Parse and Classify
                const analyzed = parseMessage(raw);
                const classification = computeExpenseScore(analyzed);

                // 4. Insert
                const info = db.prepare(`
                    INSERT INTO messages (
                        gmail_message_id, thread_id, internal_date_ms, date_iso, 
                        from_email, from_domain, subject, snippet, 
                        label, score, reasons_json, links_json, status, is_read
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW', 0)
                `).run(
                    analyzed.id, analyzed.threadId, analyzed.date.getTime(), analyzed.date.toISOString(),
                    analyzed.from, analyzed.from.split('@')[1] || '', analyzed.subject, analyzed.snippet,
                    classification.label, classification.score, JSON.stringify(classification.reasons),
                    JSON.stringify(analyzed.links || [])
                );

                const messageId = info.lastInsertRowid;

                // 5. Pre-create evidence items
                for (const att of analyzed.attachments) {
                    db.prepare(`
                        INSERT INTO evidence_items (message_id, kind, filename, mime_type, size_bytes, attachment_id)
                        VALUES (?, 'ATTACHMENT', ?, ?, ?, ?)
                    `).run(messageId, att.filename, att.mimeType, att.size, att.attachmentId || null);
                }

                count++;
                wasInserted = true;
                logger.info(`Processed message ${analyzed.id}: ${classification.label} (Bucket: ${bucket})`);
            }
        } else {
             logger.debug(`Skipping existing message ${msgStub.id} (found in ${bucket})`);
        }
        
        // Pass result back to generator
        nextVal = await iterator.next(wasInserted);
    }
    
    // Return stats from scanner (we can access them if we made them public or returned them?
    // The generator doesn't return the stats object directly.
    // The GmailScanner should probably expose the stats of the last run or return them.
    // Wait, the generator yields items. How to get the return value of a generator?
    // In JS: const result = await iterator.next(); if done, result.value is the return value.
    // Let's check if nextVal.value has the stats when done is true.
    return nextVal.value; 
}

export async function evidenceStep(options: { mock?: boolean }) {
    logger.info('Starting EVIDENCE step');
    
    // Find items needing download (ATTACHMENT)
    const items = db.prepare(`
        SELECT e.*, m.gmail_message_id 
        FROM evidence_items e
        JOIN messages m ON e.message_id = m.id
        WHERE e.local_path IS NULL AND e.kind = 'ATTACHMENT' AND m.label = 'EXPENSE'
    `).all() as any[];
    
    // 1. Process Attachment Downloads
    for (const item of items) {
        try {
            if (item.kind === 'ATTACHMENT') {
                let attachmentId = item.attachment_id;
                
                // Self-healing: If missing attachmentId (old data), fetch it
                if (!attachmentId && !options.mock) {
                     try {
                         logger.info(`Self-healing: Fetching missing attachment ID for ${item.gmail_message_id}`);
                         const raw = await gmail.getMessage(item.gmail_message_id);
                         const parsed = parseMessage(raw);
                         const match = parsed.attachments.find(a => a.filename === item.filename);
                         if (match && match.attachmentId) {
                             attachmentId = match.attachmentId;
                             // Update DB
                             db.prepare('UPDATE evidence_items SET attachment_id = ? WHERE id = ?').run(attachmentId, item.id);
                             logger.info(`Self-healing: Recovered attachment ID for ${item.id}`);
                         } else {
                             logger.warn(`Self-healing failed: Could not find attachment ${item.filename} in message ${item.gmail_message_id}`);
                         }
                     } catch (e) {
                         logger.error(`Self-healing error for ${item.id}`, { error: e });
                     }
                }

                if (!attachmentId && !options.mock) {
                    throw new Error(`Missing attachment ID for ${item.filename}`);
                }

                const localPath = await downloadAttachment(
                    item.gmail_message_id, 
                    attachmentId || 'stub_id', 
                    item.filename, 
                    options
                );
                
                const fileBuf = fs.readFileSync(localPath);
                const hash = sha256(fileBuf);
                
                db.prepare(`
                    UPDATE evidence_items 
                    SET local_path = ?, sha256 = ? 
                    WHERE id = ?
                `).run(localPath, hash, item.id);
                
                logger.info(`Downloaded evidence ${item.id}`);
            }
        } catch (e) {
            logger.error(`Failed evidence ${item.id}`, { error: e });
        }
    }

    // 2. Process Link Captures
    if (config.linkCapture.enabled) {
        logger.info('Starting LINK CAPTURE processing...');
        
        // Find messages with label EXPENSE and no successfully downloaded evidence items yet
        const candidateMessages = db.prepare(`
            SELECT m.* FROM messages m
            WHERE m.label = 'EXPENSE'
            AND NOT EXISTS (
                SELECT 1 FROM evidence_items e 
                WHERE e.message_id = m.id AND e.local_path IS NOT NULL
            )
            AND NOT EXISTS (
                SELECT 1 FROM evidence_links l 
                WHERE l.message_id = m.id AND l.status = 'DOWNLOADED'
            )
        `).all() as any[];

        const { pickInvoiceLinks } = require('../evidence/linkScoring');
        const { LinkDownloader } = require('../evidence/linkDownloader');
        const downloader = new LinkDownloader();

        for (const msg of candidateMessages) {
             try {
                let links: any[] = [];
                if (msg.links_json) {
                    links = JSON.parse(msg.links_json);
                }

                if (links.length === 0) continue;

                // Score and select top candidates
                const selectedLinks = pickInvoiceLinks({ ...msg, links }, config.linkCapture.maxPerMessage);
                
                for (const linkObj of selectedLinks) {
                    const url = linkObj.url;
                    
                    // Check if we already tried this specific URL for this message
                    const existingLink = db.prepare('SELECT id, status FROM evidence_links WHERE message_id = ? AND url_original = ?').get(msg.id, url) as any;
                    if (existingLink && (existingLink.status === 'DOWNLOADED' || existingLink.status === 'NEEDS_LOGIN')) {
                        continue;
                    }

                    // Insert or update to DOWNLOADING
                    let linkId: number | bigint;
                    if (existingLink) {
                        linkId = existingLink.id;
                        db.prepare('UPDATE evidence_links SET status = "DOWNLOADING" WHERE id = ?').run(linkId);
                    } else {
                        const info = db.prepare(`
                            INSERT INTO evidence_links (message_id, url_original, anchor_text, context_snippet, status)
                            VALUES (?, ?, ?, ?, 'DOWNLOADING')
                        `).run(msg.id, url, linkObj.anchorText || null, linkObj.context || null);
                        linkId = info.lastInsertRowid;
                    }

                    // Attempt Download
                    logger.info(`Attempting link download: ${url} for message ${msg.id}`);
                    const destDir = path.join(config.dataDir, 'evidence', moment(msg.date_iso).format('YYYY/MM'), msg.gmail_message_id, 'links');
                    const result = await downloader.download(url, destDir);

                    // Update evidence_links
                    db.prepare(`
                        UPDATE evidence_links 
                        SET status = ?, url_resolved = ?, content_type = ?, filename = ?, file_path = ?, file_sha256 = ?, http_status = ?, failure_reason = ?
                        WHERE id = ?
                    `).run(
                        result.status, result.resolvedUrl || null, result.contentType || null, 
                        result.filename || null, result.localPath || null, result.sha256 || null,
                        result.httpStatus || null, result.failureReason || null,
                        linkId
                    );

                    // If success, also create a record in evidence_items for easy review/export
                    if (result.status === 'DOWNLOADED' && result.localPath) {
                        db.prepare(`
                            INSERT INTO evidence_items (message_id, kind, filename, mime_type, size_bytes, local_path, source_url, sha256)
                            VALUES (?, 'LINK_FILE', ?, ?, ?, ?, ?, ?)
                        `).run(
                            msg.id, result.filename, result.contentType, result.sizeBytes, 
                            result.localPath, url, result.sha256
                        );
                        logger.info(`Link capture success: ${url} -> ${result.filename}`);
                        break; // Stop after first successful invoice for this message (configurable?)
                    } else {
                        logger.warn(`Link capture ${result.status}: ${url}. Reason: ${result.failureReason}`);
                    }
                }

             } catch (e) {
                 logger.error(`Link processing failed for message ${msg.id}`, e);
             }
        }
    }

}

export async function exportStep(range: DateRange, options: { mock?: boolean }) {
    logger.info(`Starting EXPORT step for ${range.label}`);
    
    const settings = getSettings();
    const labeler = settings.gmail.labelOnExport ? new GmailLabeler() : null;
    const labeledMessages = new Set<string>();

    // Find evidence not exported
    const items = db.prepare(`
        SELECT e.*, m.from_email, m.from_domain, m.date_iso, m.gmail_message_id,
               (SELECT vendor_override FROM decisions d WHERE d.message_id = m.id ORDER BY d.decided_at DESC LIMIT 1) as vendor_override
        FROM evidence_items e
        JOIN messages m ON e.message_id = m.id
        WHERE e.local_path IS NOT NULL 
          AND m.label = 'EXPENSE'
          AND NOT EXISTS (SELECT 1 FROM exports x WHERE x.evidence_id = e.id)
    `).all() as any[];
    
    for (const item of items) {
        try {
            // Resolve Vendor
            const vendor = resolveVendorName({
                vendor_override: item.vendor_override,
                from_header: item.from_email,
                from_domain: item.from_domain
            });
            const date = new Date(item.date_iso);
            
            await exportEvidence(item, date, vendor, options);
            logger.info(`Exported evidence ${item.id} to ${vendor}`);

            if (labeler && !labeledMessages.has(item.gmail_message_id)) {
                try {
                    await labeler.applyLabel(item.gmail_message_id, 'FetchExpanse/Exported');
                    labeledMessages.add(item.gmail_message_id);
                } catch (le) {
                    logger.error(`Failed to label message ${item.gmail_message_id}`, le);
                }
            }

        } catch (e) {
            logger.error(`Failed export ${item.id}`, { error: e });
        }
    }
}

export async function previewExportStep(range: DateRange) {
    const items = db.prepare(`
        SELECT e.*, m.from_email, m.from_domain, m.date_iso,
               (SELECT vendor_override FROM decisions d WHERE d.message_id = m.id ORDER BY d.decided_at DESC LIMIT 1) as vendor_override
        FROM evidence_items e
        JOIN messages m ON e.message_id = m.id
        WHERE e.local_path IS NOT NULL 
          AND m.label = 'EXPENSE'
          AND m.internal_date_ms >= ? AND m.internal_date_ms <= ?
          AND NOT EXISTS (SELECT 1 FROM exports x WHERE x.evidence_id = e.id)
    `).all(new Date(range.from).getTime(), new Date(range.to).setHours(23,59,59,999)) as any[];

    const paths: string[] = [];
    
    for (const item of items) {
        const vendor = resolveVendorName({
            vendor_override: item.vendor_override,
            from_header: item.from_email,
            from_domain: item.from_domain
        });
        const date = new Date(item.date_iso);
        const p = getDropboxPath(date, vendor, item.filename);
        paths.push(p);
    }
    
    return paths.sort();
}
