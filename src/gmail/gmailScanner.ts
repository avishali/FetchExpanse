
import { GmailClient, GmailMessageMinimal } from './gmailClient';
import { DateRange } from '../types/dateRange';
import moment from 'moment';
import { logger } from '../logging/logger';
import { getDb } from '../db/db';

export type RecallMode = 'NORMAL' | 'HIGH_RECALL' | 'HIGH_RECALL_STRICT';

interface ScannerStats {
    totalFound: number;
    totalInserted: number;
    truncated: boolean;
    truncationReason?: string;
    buckets: BucketStats[];
}

interface BucketStats {
    name: string;
    query: string;
    found: number;
    inserted: number;
    truncated: boolean;
}

const BUCKET_LIMITS = {
    NORMAL: 300,
    HIGH_RECALL: 300,
    HIGH_RECALL_STRICT: 300
};

const TOTAL_LIMITS = {
    NORMAL: 500,
    HIGH_RECALL: 2000,
    HIGH_RECALL_STRICT: 2000
};

const HEBREW_TERMS = [
    'חשבונית', 'קבלה', 'חשבונית מס', 'חשבונית/קבלה', 'אישור תשלום', 
    'הזמנה', 'שולם', 'קבלה עבור', 'חשבון', 'לתשלום'
];

const ENGLISH_TERMS = [
    'invoice', 'receipt', 'tax invoice', 'billing', 'paid', 
    'payment', 'order confirmation', 'your order', 'bill'
];

const VENDORS = [
    'stripe', 'paypal', 'square', 'shopify', 'quickbooks', 
    'invoice number', 'inv #', 'ref #'
];

export class GmailScanner {
    private gmail: GmailClient;
    private db = getDb();

    constructor(gmailClient: GmailClient) {
        this.gmail = gmailClient;
    }

    async scan(range: DateRange, mode: RecallMode = 'NORMAL'): Promise<ScannerStats> {
        logger.info(`Starting Scan: ${mode} (${range.label})`);
        
        const runId = this.createRunRecord(range, mode);
        const buckets = this.buildBuckets(range, mode);
        
        const stats: ScannerStats = {
            totalFound: 0,
            totalInserted: 0,
            truncated: false,
            buckets: []
        };

        const seenIds = new Set<string>();
        const maxPerBucket = BUCKET_LIMITS[mode];
        const maxTotal = TOTAL_LIMITS[mode];

        for (const bucket of buckets) {
            // Check global safety
            if (stats.totalFound >= maxTotal) {
                stats.truncated = true;
                stats.truncationReason = `Total limit ${maxTotal} reached`;
                logger.warn(`Scan truncated: ${stats.truncationReason}`);
                break;
            }

            logger.info(`Scanning Bucket: ${bucket.name}`);
            const bucketStat: BucketStats = {
                name: bucket.name,
                query: bucket.query,
                found: 0,
                inserted: 0,
                truncated: false
            };
            
            try {
                // Fetch with limit + 1 to detect truncation
                const messages = await this.gmail.listMessages(bucket.query, { 
                    limit: maxPerBucket + 1,
                    includeSpamTrash: false 
                });

                if (messages.length > maxPerBucket) {
                    bucketStat.truncated = true;
                    messages.pop(); // Remove the extra one
                }

                bucketStat.found = messages.length;

                // Dedup
                const uniqueMessages = messages.filter(m => !seenIds.has(m.id));
                uniqueMessages.forEach(m => seenIds.add(m.id));

                // Process (Only return IDs here, actual processing happens in caller or we pass a processor?)
                // Actually, steps.ts manages processing. 
                // To keep this clean, let's return the messages found in this bucket so caller can process?
                // OR we can make this class do the processing if we pass the process callback.
                // Let's return IDs and let caller process, but we need to know inserted count.
                // Better: Pass a callback `processMessage(id): Promise<boolean>` (returns true if inserted)
            } catch (e) {
                logger.error(`Bucket ${bucket.name} failed`, e);
            }
             
            // Wait, we need to process them to know if inserted.
            // Refactoring to yield batches or accept callback.
            // Let's use a callback pattern.
            stats.buckets.push(bucketStat);
        }

        // We need to actually fetch execution flow. 
        // Let's keep `scanStep` logic here mostly? 
        // Or make `scan` generator?
        
        return stats;
    }

    // New Scan Method that yields results to keep steps.ts logic clean
    async * scanGenerator(range: DateRange, mode: RecallMode = 'NORMAL'): AsyncGenerator<{ msg: GmailMessageMinimal, bucket: string }, void, boolean> {
        const runId = this.createRunRecord(range, mode);
        logger.info(`Run ID: ${runId}`);
        
        const buckets = this.buildBuckets(range, mode);
        const seenIds = new Set<string>(); // Global dedup
        
        const limits = {
            bucket: BUCKET_LIMITS[mode],
            total: TOTAL_LIMITS[mode]
        };

        let totalFound = 0;
        let totalInserted = 0;
        let globalTruncated = false;

        for (const bucket of buckets) {
            if (totalFound >= limits.total) {
                globalTruncated = true;
                break;
            }

            const bucketStat = {
                run_id: runId,
                bucket_name: bucket.name,
                query: bucket.query,
                found_count: 0,
                inserted_count: 0,
                is_truncated: 0
            };

            // Calculate remaining allowance for this bucket
            // logic: limit is PER BUCKET.
            
            try {
                const list = await this.gmail.listMessages(bucket.query, { limit: limits.bucket + 1 });
                
                if (list.length > limits.bucket) {
                    bucketStat.is_truncated = 1;
                    list.pop();
                }
                
                bucketStat.found_count = list.length;
                totalFound += list.length; // Approximate (includes dups across buckets)

                for (const msg of list) {
                    if (seenIds.has(msg.id)) continue;
                    seenIds.add(msg.id);
                    
                    // Yield to caller to process
                    const wasInserted = yield { msg, bucket: bucket.name };
                    if (wasInserted) {
                        bucketStat.inserted_count++;
                        totalInserted++;
                    }
                }
            } catch (e) {
                logger.error(`Bucket ${bucket.name} error`, e);
            }

            // Save bucket stats
            this.db.prepare(`
                INSERT INTO scan_run_buckets (run_id, bucket_name, query, found_count, inserted_count, is_truncated)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(runId, bucket.name, bucket.query, bucketStat.found_count, bucketStat.inserted_count, bucketStat.is_truncated);
        }

        // Update Run Record
        this.db.prepare(`
            UPDATE scan_runs 
            SET status = 'COMPLETED', total_found = ?, total_inserted = ?, is_truncated = ?
            WHERE id = ?
        `).run(totalFound, totalInserted, globalTruncated ? 1 : 0, runId);
    }

    private createRunRecord(range: DateRange, mode: string): number | bigint {
        const start = new Date(range.from).getTime();
        const end = new Date(range.to).setHours(23,59,59,999);
        const res = this.db.prepare(`
            INSERT INTO scan_runs (mode, range_start, range_end, status)
            VALUES (?, ?, ?, 'RUNNING')
        `).run(mode, start, end);
        return res.lastInsertRowid;
    }

    private buildBuckets(range: DateRange, mode: RecallMode) {
        // Date format for Gmail query
        const after = moment(range.from).format('YYYY/MM/DD');
        const before = moment(range.to).add(1, 'day').format('YYYY/MM/DD'); // Gmail before is exclusive
        const dateQuery = `after:${after} before:${before}`;
        
        const buckets = [];

        // 1. Core Keywords (EN)
        buckets.push({
            name: 'Keywords (EN)',
            query: `${dateQuery} (${ENGLISH_TERMS.map(t => `"${t}"`).join(' OR ')})`
        });

        // 2. Core Keywords (HE)
        buckets.push({
            name: 'Keywords (HE)',
            query: `${dateQuery} (${HEBREW_TERMS.map(t => `"${t}"`).join(' OR ')})`
        });

        // 3. Attachments (Broad)
        // Only if High Recall
        if (mode !== 'NORMAL') {
             buckets.push({
                name: 'Attachments (Broad)',
                query: `${dateQuery} has:attachment (invoice OR receipt OR bill OR payment OR חשבונית OR קבלה)`
            });
        }

        // 4. Vendors
        buckets.push({
            name: 'Vendors',
            query: `${dateQuery} (${VENDORS.map(t => `"${t}"`).join(' OR ')})`
        });

        // 5. Purchases Category (if not strict)
        if (mode === 'HIGH_RECALL') {
            buckets.push({
                name: 'Category: Purchases',
                query: `${dateQuery} category:purchases`
            });
        }

        return buckets;
    }
}
