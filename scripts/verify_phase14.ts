
import { GmailScanner } from '../src/gmail/gmailScanner';
import { GmailClient } from '../src/gmail/gmailClient';
import { getDb } from '../src/db/db';
import { logger } from '../src/logging/logger';
import assert from 'assert';

// Mock Gmail Client
class MockGmailClient extends GmailClient {
    async listMessages(query: string, options: any): Promise<any[]> {
        console.log(`[Mock] listMessages: ${query}`);
        
        // Simulate high volume for "invoice"
        if (query.includes('invoice')) {
            // Return 301 messages to trigger truncation of 300 limit
            return Array(301).fill(0).map((_, i) => ({ id: `msg_${i}`, threadId: `th_${i}` }));
        }
        
        // Simulate some results for Hebrew
        if (query.includes('חשבונית')) {
            return [{ id: 'he_1', threadId: 'he_1' }];
        }
        
        return [];
    }
    
    async getMessage(id: string, options: any): Promise<any> {
        return {
            id,
            threadId: id,
            internalDate: Date.now().toString(),
            payload: {
                headers: [
                    { name: 'From', value: 'sender@example.com' },
                    { name: 'Subject', value: 'Invoice' }
                ],
                parts: [
                    { mimeType: 'text/plain', body: { data: Buffer.from('test').toString('base64') } }
                ]
            }
        };
    }
}

async function verify() {
    console.log('--- STARTING PHASE 14 VERIFICATION ---');
    const db = getDb();
    const mockGmail = new MockGmailClient() as any; 
    const scanner = new GmailScanner(mockGmail); 

    // Test 1: High Recall Mode
    console.log('\nTest 1: High Recall Mode Scan');
    const range = { from: '2023-01-01', to: '2023-01-31', label: 'Jan 23', fromDate: new Date('2023-01-01'), toDate: new Date('2023-01-31') };
    
    const generator = scanner.scanGenerator(range, 'HIGH_RECALL');
    let count = 0;
    
    const iterator = generator[Symbol.asyncIterator]();
    let nextVal = await iterator.next();
    
    while (!nextVal.done) {
        count++;
        // Simulate inserted = true
        nextVal = await iterator.next(true);
    }
    
    console.log(`Processed ${count} messages`);
    
    // Verify DB
    const lastRun = db.prepare('SELECT * FROM scan_runs ORDER BY id DESC LIMIT 1').get() as any;
    console.log('Last Run:', lastRun);
    assert.strictEqual(lastRun.mode, 'HIGH_RECALL');
    
    // Check Buckets
    const buckets = db.prepare('SELECT * FROM scan_run_buckets WHERE run_id = ?').all(lastRun.id) as any[];
    console.log('Buckets:', buckets.map(b => `${b.bucket_name}: ${b.found_count} (Truncated: ${b.is_truncated})`));
    
    // Expect truncation in Keywords (EN) because we returned 301 items
    const enBucket = buckets.find(b => b.bucket_name === 'Keywords (EN)');
    assert.ok(enBucket, 'Keywords (EN) bucket missing');
    assert.strictEqual(enBucket.is_truncated, 1, 'Keywords (EN) should be truncated');
    assert.strictEqual(enBucket.found_count, 300, 'Keywords (EN) found count should be capped at 300'); // Our logic pops the extra one
    
    // Expect Hebrew bucket
    const heBucket = buckets.find(b => b.bucket_name === 'Keywords (HE)');
    assert.ok(heBucket, 'Keywords (HE) bucket missing');
    
    console.log('--- VERIFICATION SUCCESS ---');
}

verify().catch(e => {
    console.error(e);
    process.exit(1);
});
