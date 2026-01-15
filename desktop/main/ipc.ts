import { ipcMain, shell } from 'electron';
import { app } from 'electron';
import path from 'path';
import { getSettings, saveSettings } from '../../src/configStore';
import { config, DATA_DIR, DB_PATH } from '../../src/config';
import { getStoredGmailTokens, authorizeGmail } from '../../src/auth/googleAuth';
import { getStoredDropboxTokens, authorizeDropbox } from '../../src/auth/dropboxAuth';
import { scanStep, evidenceStep, previewExportStep } from '../../src/pipeline/steps';
import { getDb } from '../../src/db/db';
import { logger } from '../../src/logging/logger';
import { DateRange, DateRangeArgs, resolveDateRange } from '../../src/types/dateRange';

import { detectRecurring } from '../../src/recurring/recurringDetector';
import { generateRecurringReport } from '../../src/report/manifest';
import { exportStep } from '../../src/pipeline/steps';
import { getCoverageSummary, getCoverageByMonth, getIncompleteItemIds } from '../../src/db/queries/coverage';
import { 
  createAccount, listAccounts, insertTransactions, 
  getMatchedTransactions, getUnmatchedTransactions, getOrphanExpenses 
} from '../../src/db/queries/bank';
import { parseBankCsv, previewBankCsv } from '../../src/app/bank/import';
import { generateAccountantPack } from '../../src/app/export/accountant';
import { BankMatcher } from '../../src/app/bank/matcher';
import * as fs from 'fs';

// ... existing imports ...

export function setupIpc(mainWindow: any) {
  ipcMain.on('log:error', (_event, error) => {
      logger.error('Renderer Error:', error);
      console.error('Renderer Error:', error);
  });


  ipcMain.handle('app:info', () => {
      const gmail = getStoredGmailTokens();
      const dropbox = getStoredDropboxTokens();
      return {
          version: app.getVersion(),
          dataDir: DATA_DIR,
          dbPath: DB_PATH,
          auth: {
              gmail: !!gmail,
              dropbox: !!dropbox
          },
          config: {
              linkCapture: config.linkCapture
          }

      };
  });

  ipcMain.handle('app:doctor', async () => {
      // Simple doctor check: Check auth tokens
      const gmail = getStoredGmailTokens();
      const dropbox = getStoredDropboxTokens();
      return {
          gmail: !!gmail,
          dropbox: !!dropbox
      };
  });

  ipcMain.handle('app:getSettings', () => {
      return getSettings();
  });

  ipcMain.handle('app:saveSettings', (_, settings: any) => {
      saveSettings(settings);
      return { ok: true };
  });

  ipcMain.handle('open:external', async (_, url: string) => {
      if (url && url.startsWith('http')) await shell.openExternal(url);
  });

  ipcMain.handle('auth:gmail', async () => {
      await authorizeGmail(); // This opens browser callback
      return true;
  });

  ipcMain.handle('auth:dropbox', async () => {
      await authorizeDropbox();
      return true;
  });


  ipcMain.handle('scan:start', async (_, args: DateRangeArgs, options: { mock?: boolean, recall?: 'normal' | 'high', includeSpam?: boolean, includeTrash?: boolean }) => {
     try {
         const range = resolveDateRange(args);
         const stats = await scanStep(range, options);
         mainWindow.webContents.send('scan:progress', { stage: 'scan', current: 100, total: 100, message: 'Scan complete' });
         
         await evidenceStep(options);
         mainWindow.webContents.send('scan:progress', { stage: 'evidence', current: 100, total: 100, message: 'Evidence complete' });

         return { ok: true, stats };
     } catch (e: any) {
         logger.error('Scan failed', { error: e });
         return { ok: false, error: e.message };
     }
  });

  // Review
  // Review
  ipcMain.handle('review:list', async (_, args: DateRangeArgs, status?: string) => {
      const db = getDb();
      const range = resolveDateRange(args);

      // Assume range is { from: 'YYYY-MM-DD', to: 'YYYY-MM-DD' }
      // We need to filter by internal_date_ms
      const endDate = new Date(range.to);
      endDate.setHours(23, 59, 59, 999);
      
      const startMs = new Date(range.from).getTime();
      const endMs = endDate.getTime();
      
      // LEFT JOIN with decisions to get the LATEST vendor override
      // Note: decisions table is a log, so getting the latest is slightly complex in pure SQL without window functions or subqueries.
      // Simpler: Just get the messages and let pure JS UI handle matching if we fetched decisions separately?
      // Or: Subquery in select.
      
      let sql = `
        SELECT m.*, 
            (SELECT vendor_override FROM decisions d WHERE d.message_id = m.id ORDER BY d.decided_at DESC LIMIT 1) as vendor_override
        FROM messages m 
        WHERE m.internal_date_ms >= ? AND m.internal_date_ms <= ?
      `;
      const params: any[] = [startMs, endMs];
      
      if (status && status !== 'ALL') {
          if (status === 'MISSING_EVIDENCE') {
              sql += ` AND m.label = 'EXPENSE' AND (
                  (SELECT COUNT(*) FROM evidence_items WHERE message_id = m.id) = 0
                  AND (m.links_json IS NULL OR m.links_json = '[]' OR m.links_json = '')
              )`;
          } else if (status === 'MISSING_AMOUNT') {
              // Placeholder for missing amount logic (Phase 3 spec: disabled or 0 if not enabled)
              sql += ` AND m.label = 'EXPENSE' AND 0`; 
          } else {
              sql += ` AND m.label = ?`;
              params.push(status);
          }
      }
      
      sql += ` ORDER BY m.internal_date_ms DESC`;
      
      return db.prepare(sql).all(...params);
  });

  ipcMain.handle('review:detail', async (_, id: number) => {
      const db = getDb();
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
      
      // Fetch override
      const decision = db.prepare('SELECT vendor_override FROM decisions WHERE message_id = ? ORDER BY decided_at DESC LIMIT 1').get(id) as any;
      if (decision && decision.vendor_override) {
          msg.vendor_override = decision.vendor_override;
      }
      
      const evidence = db.prepare('SELECT * FROM evidence_items WHERE message_id = ?').all(id);
      const links = db.prepare('SELECT * FROM evidence_links WHERE message_id = ?').all(id);
      return { message: msg, evidence, links };
  });

  ipcMain.handle('review:decision', async (_, id: number, status: string, vendor?: string, category?: string) => {
      const db = getDb();
      
      // 1. Update Message Label and Read status
      db.prepare("UPDATE messages SET label = ?, is_read = 1, read_at_ms = ? WHERE id = ?").run(status, Date.now(), id);
      
      // 2. Log Decision (with Override)
      db.prepare(`
        INSERT INTO decisions (message_id, status, vendor_override, category)
        VALUES (?, ?, ?, ?)
      `).run(id, status, vendor || null, category || null);

      // 3. Gmail Labeling (Async, don't block UI)
      const settings = getSettings();
      if (settings.gmail.labelOnDecision) {
           const msg = db.prepare('SELECT gmail_message_id FROM messages WHERE id = ?').get(id) as any;
           if (msg && msg.gmail_message_id) {
               // Fire and forget or await? Await might be safer for rate limits but slows UI.
               // We'll await but catch errors so UI doesn't break.
               (async () => {
                   try {
                       const { GmailLabeler } = require('../../src/gmail/gmailLabeler');
                       const labeler = new GmailLabeler();
                       let labelName = '';
                       if (status === 'EXPENSE') labelName = 'FetchExpanse/Expense';
                       // if (status === 'NOT_EXPENSE') labelName = 'FetchExpanse/NotExpense'; // Optional
                       
                       if (labelName) {
                           await labeler.applyLabel(msg.gmail_message_id, labelName);
                       }
                   } catch (e) {
                       logger.error('Failed to auto-label message', e);
                   }
               })();
           }
      }
      
      return { ok: true };
  });

  ipcMain.handle('review:markRead', async (_, ids: number[]) => {
      const db = getDb();
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE messages SET is_read = 1, read_at_ms = ? WHERE id IN (${placeholders})`)
        .run(Date.now(), ...ids);
      return { ok: true };
  });

  ipcMain.handle('review:markUnread', async (_, ids: number[]) => {
      const db = getDb();
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE messages SET is_read = 0, read_at_ms = NULL WHERE id IN (${placeholders})`)
        .run(...ids);
      return { ok: true };
  });

  ipcMain.handle('review:next', async (_, currentId: number, args: DateRangeArgs, filter: string) => {
      const db = getDb();
      const range = resolveDateRange(args);
      const endDate = new Date(range.to);
      endDate.setHours(23, 59, 59, 999);
      const startMs = new Date(range.from).getTime();
      const endMs = endDate.getTime();
      
      let sql = `SELECT id FROM messages WHERE internal_date_ms >= ? AND internal_date_ms <= ?`;
      const params: any[] = [startMs, endMs];
      
      if (filter && filter !== 'ALL') {
          sql += ` AND label = ?`;
          params.push(filter);
      }
      sql += ` ORDER BY internal_date_ms DESC`;
      
      const rows = db.prepare(sql).all(...params) as { id: number }[];
      const idx = rows.findIndex(r => r.id === currentId);
      
      if (idx !== -1 && idx < rows.length - 1) {
          return rows[idx + 1].id;
      }
      return null;
  });

  ipcMain.handle('review:suggest', async (_, id: number) => {
      const db = getDb();
      const current = db.prepare('SELECT from_domain, from_email FROM messages WHERE id = ?').get(id) as any;
      if (!current) return null;

      // Try matching domain first
      if (current.from_domain) {
          const match = db.prepare(`
              SELECT label, reasons_json FROM messages 
              WHERE from_domain = ? AND label IN ('EXPENSE', 'NOT_EXPENSE') AND id != ?
              ORDER BY internal_date_ms DESC LIMIT 1
          `).get(current.from_domain, id) as any;
          
          if (match) {
              return { status: match.label };
              // TODO: Store vendor/category in a better way. For now just suggest status.
          }
      }
      return null;
  });

  ipcMain.handle('review:batch', async (_, ids: number[], status: string, vendor?: string, category?: string) => {
      const db = getDb();
      const placeholders = ids.map(() => '?').join(',');
      db.prepare(`UPDATE messages SET label = ? WHERE id IN (${placeholders})`).run(status, ...ids);
      return { ok: true };
  });

  // Export
  ipcMain.handle('export:start', async (_, args: DateRangeArgs, options: { mock?: boolean }) => {
      try {
          const range = resolveDateRange(args);
          await exportStep(range, options);
          mainWindow.webContents.send('export:progress', { stage: 'export', current: 100, total: 100, message: 'Export complete' });
          return { ok: true };
      } catch (e: any) {
          return { ok: false, error: e.message };
      }
  });

  ipcMain.handle('export:preview', async (_, args: DateRangeArgs) => {
      try {
          const range = resolveDateRange(args);
          const paths = await previewExportStep(range);
          return paths;
      } catch (e: any) {
          logger.error('Export preview failed', e);
          return [];
      }
  });

  ipcMain.handle('export:accountantPack', async (_, args: DateRangeArgs) => {
      try {
          const db = getDb();
          const range = resolveDateRange(args);
          const result = await generateAccountantPack(db, range.from, range.to);
          
          // Reveal in finder
          if (result.path) shell.showItemInFolder(result.path);
          
          return result;
      } catch (e: any) {
          logger.error('Accountant Pack failed', e);
          throw e;
      }
  });

  // Recurring
  ipcMain.handle('recurring:get', async (_, args: DateRangeArgs) => {
      const range = resolveDateRange(args);
      const patterns = detectRecurring(range);
      const reportPath = generateRecurringReport(range, patterns);
      return { patterns, reportPath };
  });

  // Evidence
  ipcMain.handle('evidence:open', async (_, p: string) => {
      if (p) await shell.openPath(p);
  });
  
  ipcMain.handle('evidence:reveal', async (_, p: string) => {
      if (p) await shell.showItemInFolder(p);
  });
  
  ipcMain.handle('evidence:download', async (_, id: number, options: { mock?: boolean }) => {
      const db = getDb();
      const item = db.prepare('SELECT e.*, m.gmail_message_id FROM evidence_items e JOIN messages m ON e.message_id = m.id WHERE e.id = ?').get(id) as any;
      if (!item) throw new Error('Evidence item not found');

      if (item.local_path) return { local_path: item.local_path };

      try {
          if (item.kind === 'ATTACHMENT') {
              // Attachment Logic
              let attachmentId = item.attachment_id;
              // Simple fetch if missing ID
              if (!attachmentId && !options?.mock) {
                  const GmailClient = require('../../src/gmail/gmailClient').GmailClient; // Lazy load
                  const gmail = new GmailClient();
                  const parseMessage = require('../../src/gmail/messageParser').parseMessage;
                  
                  const raw = await gmail.getMessage(item.gmail_message_id);
                  const parsed = parseMessage(raw);
                  const match = parsed.attachments.find((a: any) => a.filename === item.filename);
                  if (match && match.attachmentId) {
                      attachmentId = match.attachmentId;
                      db.prepare('UPDATE evidence_items SET attachment_id = ? WHERE id = ?').run(attachmentId, item.id);
                  }
              }
              
              if (!attachmentId && !options?.mock) throw new Error('Missing attachment ID');

              const downloadAttachment = require('../../src/gmail/attachmentDownloader').downloadAttachment;
              const localPath = await downloadAttachment(item.gmail_message_id, attachmentId || 'stub', item.filename, options);
              
              const fs = require('fs');
              const { sha256 } = require('../../src/util/hash');
              const hash = sha256(fs.readFileSync(localPath));
              
              db.prepare('UPDATE evidence_items SET local_path = ?, sha256 = ? WHERE id = ?').run(localPath, hash, id);
              return { local_path: localPath };

          } else if (item.kind.startsWith('LINK')) {
               // Link Logic
               const { LinkCapturer } = require('../../src/evidence/linkCapturePlaywright');
               const { sha256 } = require('../../src/util/hash');
               const fs = require('fs');
               
               const capturer = new LinkCapturer();
               await capturer.init();
               try {
                   const outputDir = path.join(DATA_DIR, 'staging', 'links', item.message_id.toString());
                   const filenameBase = `link_${sha256(item.source_url).substring(0, 8)}`;
                   
                   const result = await capturer.capture(item.source_url, outputDir, filenameBase);
                   if (!result) throw new Error('Capture failed');
                   
                   const size = fs.statSync(result.localPath).size;
                   db.prepare('UPDATE evidence_items SET local_path = ?, mime_type = ?, size_bytes = ?, sha256 = ? WHERE id = ?')
                     .run(result.localPath, result.mimeType, size, result.sha256, id);
                   
                   return { local_path: result.localPath };
               } finally {
                   await capturer.close();
               }
          }
      } catch (e: any) {
          logger.error(`Download failed for ${id}`, e);
          throw e;
      }
  });

  ipcMain.handle('emailBody:get', async (_, id: number) => {
      const db = getDb();
      const msg = db.prepare('SELECT gmail_message_id FROM messages WHERE id = ?').get(id) as any;
      
      const emptyDiag = { 
          foundHtmlParts: 0, 
          foundTextParts: 0, 
          foundCidImages: 0, 
          blockedRemoteImages: 0,
          reasonIfEmpty: 'NO_BODY_PARTS' 
      };

      // Default empty structure
      const empty = { html: '', text: '', source: 'gmail', diag: emptyDiag };
      
      if (!msg || !msg.gmail_message_id) return empty;

      try {
          // Lazy load dependencies
          const GmailClient = require('../../src/gmail/gmailClient').GmailClient;
          const { extractEmailBody } = require('../../src/gmail/gmailMime');
          
          const client = new GmailClient();
          const raw = await client.getMessage(msg.gmail_message_id);
          
          const result = extractEmailBody(raw.payload);
          return { 
              html: result.html || '', 
              text: result.text || '', 
              source: 'gmail',
              diag: result.diag
          };
      } catch (e: any) {
          logger.error(`Failed to fetch body for message ${id}`, { error: e.message });
          return empty;
      }
  });
  
  ipcMain.handle('stats:get', async () => {
      const db = getDb();
      
      // Monthly Coverage
      // Group by YYYY-MM and Label
      const coverage = db.prepare(`
          SELECT strftime('%Y-%m', date_iso) as month, label, COUNT(*) as count
          FROM messages
          GROUP BY month, label
          ORDER BY month DESC
          LIMIT 12
      `).all();
      
      // Top Reasons
      // Aggregate JSON reasons (approximate since it's JSON array)
      // SQLite JSON support is good but let's just fetch TO_REVIEW items and agg in JS for MVP simplicity/robustness
      const reviews = db.prepare(`
          SELECT reasons_json FROM messages WHERE label = 'TO_REVIEW' LIMIT 1000
      `).all() as { reasons_json: string }[];
      
      const reasonsMap: Record<string, number> = {};
      reviews.forEach(r => {
          try {
              const list = JSON.parse(r.reasons_json);
              if (Array.isArray(list)) {
                  list.forEach(reason => {
                      reasonsMap[reason] = (reasonsMap[reason] || 0) + 1;
                  });
              }
          } catch (e) {}
      });
      
      const topReasons = Object.entries(reasonsMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([reason, count]) => ({ reason, count }));
          
      return { coverage, topReasons };

  });

  // Coverage (Phase 3)
  ipcMain.handle('coverage:summary', async (_, args: DateRangeArgs) => {
      const db = getDb();
      const range = resolveDateRange(args);
      const startMs = new Date(range.from).getTime();
      const endMs = new Date(range.to).setHours(23, 59, 59, 999);
      return getCoverageSummary(db, startMs, endMs);
  });

  ipcMain.handle('coverage:month', async (_, args: DateRangeArgs) => {
      const db = getDb();
      const range = resolveDateRange(args);
      const startMs = new Date(range.from).getTime();
      const endMs = new Date(range.to).setHours(23, 59, 59, 999);
      return getCoverageByMonth(db, startMs, endMs);
  });

  ipcMain.handle('coverage:incomplete', async (_, args: DateRangeArgs, kind: 'to_review' | 'missing_evidence' | 'missing_amount') => {
      const db = getDb();
      const range = resolveDateRange(args);
      const startMs = new Date(range.from).getTime();
      const endMs = new Date(range.to).setHours(23, 59, 59, 999);
      return getIncompleteItemIds(db, startMs, endMs, kind);
  });

  // Phase 4 Bank
  ipcMain.handle('bank:listAccounts', async () => {
      const db = getDb();
      return listAccounts(db);
  });

  ipcMain.handle('bank:createAccount', async (_, name: string, currency?: string) => {
      const db = getDb();
      const id = createAccount(db, name, currency);
      return { id };
  });

  ipcMain.handle('bank:previewCsv', async (_, filePath: string) => {
      return previewBankCsv(filePath);
  });

  ipcMain.handle('bank:importCsv', async (_, accountId: number, filePath: string, mapping: any) => {
      const db = getDb();
      try {
          const txns = parseBankCsv(filePath, accountId, mapping);
          const result = insertTransactions(db, txns);
          return result;
      } catch (e: any) {
          logger.error('Import failed', e);
          return { error: e.message };
      }
  });

  ipcMain.handle('bank:reconcile', async (_, accountId: number, args: DateRangeArgs) => {
      const db = getDb();
      const range = resolveDateRange(args);
      const matcher = new BankMatcher(db);
      return matcher.reconcile(accountId, range.from, range.to);
  });

  ipcMain.handle('bank:getReconciliation', async (_, accountId: number, args: DateRangeArgs) => {
      const db = getDb();
      const range = resolveDateRange(args);
      
      const matched = getMatchedTransactions(db, accountId, range.from, range.to);
      const unmatched = getUnmatchedTransactions(db, accountId, range.from, range.to);
      
      // Orphans logic needs careful date window. 
      // Matcher uses +/- 7 days. UI should probably show same window or strictly selected range?
      // "Orphan Expenses ... within date window".
      // Let's use strict range for UI view.
      const orphans = getOrphanExpenses(db, range.from, range.to);
      
      return { matched, unmatched, orphans };
  });

  ipcMain.handle('bank:export', async (_, accountId: number, args: DateRangeArgs) => {
      const db = getDb();
      const range = resolveDateRange(args);
      const matched = getMatchedTransactions(db, accountId, range.from, range.to);
      const unmatched = getUnmatchedTransactions(db, accountId, range.from, range.to);
      
      const lines = ['txn_id,date,amount,description,status,match_score,match_reason,matched_vendor'];
      
      matched.forEach(m => {
          lines.push(`${m.txn_id},${m.txn_date},${m.amount},"${m.description.replace(/"/g, '""')}",MATCHED,${m.match_score},"${m.match_reason}","${m.subject.replace(/"/g, '""')}"`);
      });
      
      unmatched.forEach(u => {
          lines.push(`${u.id},${u.txn_date},${u.amount},"${u.description.replace(/"/g, '""')}",UNMATCHED,,,`);
      });
      
      const fileName = `reconciliation_${accountId}_${range.from}_${range.to}.csv`;
      const outPath = path.join(DATA_DIR, 'exports', fileName);
      
      fs.mkdirSync(path.join(DATA_DIR, 'exports'), { recursive: true });
      fs.writeFileSync(outPath, lines.join('\n'));
      
      return { path: outPath };
  });
}
