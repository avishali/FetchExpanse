import { program } from './args';
import { scanStep, evidenceStep, exportStep } from '../pipeline/steps';
import { detectRecurring } from '../recurring/recurringDetector'; 
import { generateRecurringReport } from '../report/manifest';
import { config, DATA_DIR } from '../config';
import { logger } from '../logging/logger';
import { getDb } from '../db/db';
import { authorizeGmail, getStoredGmailTokens } from '../auth/googleAuth';
import { authorizeDropbox, getStoredDropboxTokens } from '../auth/dropboxAuth';

import { resolveDateRange } from '../types/dateRange';
import fs from 'fs';
import path from 'path';

import { registerBankCommands } from './bank';

export function registerCommands() {
  registerBankCommands(program);
  program
    .command('doctor')
    .description('Check environment setup')
    .action(() => {
        console.log('Checking environment...');
        const missing: string[] = [];
        if (!config.gmail.clientId) missing.push('GMAIL_OAUTH_CLIENT_ID');
        if (!config.dropbox.appKey) missing.push('DROPBOX_APP_KEY');
        
        if (missing.length) {
            console.error('Missing env vars:', missing.join(', '));
        } else {
            console.log('Environment vars OK');
        }

        // Check tokens
        const gmailTokens = getStoredGmailTokens();
        if (gmailTokens) {
            console.log('Gmail tokens: FOUND');
        } else {
            console.log('Gmail tokens: MSG (Run "expense auth gmail")');
        }
        
        const dropboxTokens = getStoredDropboxTokens();
        if (dropboxTokens) {
            console.log('Dropbox tokens: FOUND');
        } else {
            console.log('Dropbox tokens: MSG (Run "expense auth dropbox")');
        }
    });

  const authCmd = program.command('auth').description('Manage authentication');

  authCmd
    .command('gmail')
    .description('Authenticate with Gmail')
    .option('--reauth', 'Force re-authentication')
    .action(async (opts: any) => {
        try {
            await authorizeGmail({ reauth: opts.reauth });
            console.log('Gmail authentication successful.');
        } catch (e) {
            console.error('Gmail authentication failed:', e);
            process.exit(1);
        }
    });

  authCmd
    .command('dropbox')
    .description('Authenticate with Dropbox')
    .option('--reauth', 'Force re-authentication')
    .action(async (opts: any) => {
        try {
            await authorizeDropbox({ reauth: opts.reauth });
            console.log('Dropbox authentication successful.');
        } catch (e) {
            console.error('Dropbox authentication failed:', e);
            process.exit(1);
        }
    });

  program
    .command('scan')
    .option('--year <year>', 'Year to scan') // Kept for backward compat
    .option('--from <date>', 'From date YYYY-MM-DD')
    .option('--to <date>', 'To date YYYY-MM-DD')
    .option('--preset <preset>', 'Date range preset')
    .option('--mock', 'Run in mock mode')
    .option('--limit <n>', 'Limit messages')
    .option('--recall <mode>', 'Recall mode (normal, high)', 'normal')
    .option('--include-spam', 'Include Spam folder')
    .option('--include-trash', 'Include Trash folder')
    .action(async (opts: any) => {
        const tokens = getStoredGmailTokens();
        if (!opts.mock && !tokens) {
            console.error('Error: No Gmail tokens found. Run "expense auth gmail" first, or use --mock.');
            process.exit(1);
        }

        // Policy: High Recall requires limit
        if (opts.recall === 'high' && !opts.limit) {
            console.error('Error: High recall mode requires --limit to prevent unbounded scans.');
            process.exit(1);
        }
        
        try {
            const range = resolveDateRange(opts);
            await scanStep(range, { 
                mock: opts.mock, 
                limit: opts.limit ? parseInt(opts.limit) : undefined,
                recall: opts.recall as any,
                includeSpam: opts.includeSpam,
                includeTrash: opts.includeTrash
            });
            await evidenceStep({ mock: opts.mock });
        } catch (e) {
            console.error('Scan failed:', e);
            // Don't exit 1 if it's just a query error, but here it's main flow.
            process.exit(1);
        }
    });

  program
    .command('export')
    .option('--year <year>', 'Year to scan')
    .option('--from <date>', 'From date YYYY-MM-DD')
    .option('--to <date>', 'To date YYYY-MM-DD')
    .option('--preset <preset>', 'Date range preset')
    .option('--mock', 'Run in mock mode')
    .action(async (opts: any) => {
         try {
             // exportStep signature needs update to accept DateRange or we pass it
             // Current exportStep(year, options) -> we will change it to exportStep(range, options)
             const range = resolveDateRange(opts);
             await exportStep(range, { mock: opts.mock });
         } catch (e) {
             console.error('Export failed:', e);
             process.exit(1);
         }
    });

  program
    .command('recurring')
    .option('--year <year>', 'Year')
    .option('--from <date>', 'From date YYYY-MM-DD')
    .option('--to <date>', 'To date YYYY-MM-DD')
    .option('--preset <preset>', 'Date range preset')
    .action((opts: any) => {
        try {
            const range = resolveDateRange(opts);
            const patterns = detectRecurring(range);
            console.table(patterns);
            const p = generateRecurringReport(range, patterns);
            console.log(`Report written to ${p}`);
        } catch (e) {
            console.error('Recurring detection failed:', e);
            process.exit(1);
        }
    });
    
  program
    .command('review')
    .argument('<action>', 'list or mark')
    .option('--year <year>', 'Year')
    .option('--from <date>', 'From date YYYY-MM-DD')
    .option('--to <date>', 'To date YYYY-MM-DD')
    .option('--preset <preset>', 'Date range preset')
    .option('--id <id>', 'DB ID')
    .option('--status <status>', 'EXPENSE, NOT_EXPENSE, TO_REVIEW')
    .action((action: string, opts: any) => {
        const db = getDb();
        if (action === 'list') {
            const range = resolveDateRange(opts);
            // Filter by range logic
            // We need to convert range to ms or ISO string comparison
            // range.from (YYYY-MM-DD) -> start of day
            // range.to (YYYY-MM-DD) -> end of day
            // We have range.fromDate and range.toDate objects from resolveDateRange
            const startMs = range.fromDate.getTime();
            const endMs = range.toDate.getTime() + 86400000; // inclusive of end date? resolveDateRange sets toDate to start of day?
            // resolveDateRange: if preset='this_year', to = endOf('year'). If manual, from/to are start of day?
            // Let's check resolveDateRange logic.
            // It parses YYYY-MM-DD. Moment defaults to start of day. 
            // So if to is 2025-01-31, it is 00:00:00. We want to include it.
            // Wait, resolveDateRange implementation:
            // "to = args.to ? moment(args.to)..."
            // "toDate: to.toDate()"
            // Actually moment parsing YYYY-MM-DD creates start of day.
            // We probably want to encompass the whole 'to' day.
            // But let's look at `buildQueriesForRange` - it did `add(1, 'days')` for 'before'.
            // Here for DB, we should also include the day.
            
            // Re-check resolveDateRange logic I wrote in Step 211.
            // It returns to: YYYY-MM-DD string.
            // DB has internal_date_ms. 
            // We should use range.to + 1 day for upper bound exclusive.
            
            const startIso = range.from;
            // Hacky add 1 day for SQL comparison or just use >= and <= if includes time?
            // SQLite date_iso is ISO string. 
            // Better to filter by internal_date_ms if possible or date_iso
            // messages has date_iso (YYYY-MM-DDTHH:mm:ss...)
            
            // Let's use internal_date_ms.
            // range.fromDate is Date object.
            
            // Adjust end date to include full day
            const endDateInclusive = new Date(range.to);
            endDateInclusive.setHours(23, 59, 59, 999);
            
            const rows = db.prepare(`
                SELECT * FROM messages 
                WHERE label = 'TO_REVIEW' 
                AND internal_date_ms >= ? AND internal_date_ms <= ?
            `).all(range.fromDate.getTime(), endDateInclusive.getTime());
            
            console.table(rows);
        } else if (action === 'mark') {
            if (!opts.id || !opts.status) {
                console.error('Missing --id or --status');
                return;
            }
            db.prepare("UPDATE messages SET label = ? WHERE id = ?").run(opts.status, opts.id);
            console.log(`Updated ${opts.id} to ${opts.status}`);
        }
    });

}
