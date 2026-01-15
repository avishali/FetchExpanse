
import { Command } from 'commander';
import { getDb } from '../db/db';
import { createAccount, insertTransactions, listAccounts } from '../db/queries/bank';
import { parseBankCsv } from '../app/bank/import';
import { BankMatcher } from '../app/bank/matcher';
import { generateReconciliationReport } from '../app/bank/report';
import { resolveDateRange } from '../types/dateRange';
import path from 'path';

export function registerBankCommands(program: Command) {
  const bank = program.command('bank').description('Bank reconciliation tools');

  bank
    .command('import')
    .requiredOption('--account <name>', 'Bank Account Name')
    .requiredOption('--file <path>', 'CSV File Path')
    .option('--currency <curr>', 'Currency (ILS, USD)')
    .option('--date-col <n>', 'Date Column Index (0-based)', '0')
    .option('--amount-col <n>', 'Amount Column Index (0-based)', '1')
    .option('--desc-col <n>', 'Description Column Index (0-based)', '2')
    .action((opts: any) => {
        const db = getDb();
        const accounts = listAccounts(db);
        let account = accounts.find(a => a.name === opts.account);
        
        if (!account) {
            console.log(`Creating new account: ${opts.account}`);
            const id = createAccount(db, opts.account, opts.currency);
            account = { id, name: opts.account, created_at_ms: Date.now() };
        } else {
            console.log(`Using account: ${account.name} (ID: ${account.id})`);
        }
        
        const mapping = {
            dateIndex: parseInt(opts.dateCol),
            amountIndex: parseInt(opts.amountCol),
            descIndex: parseInt(opts.descCol),
            currencyIndex: undefined // TODO CLI option
        };
        
        console.log(`Parsing ${opts.file}...`);
        const txns = parseBankCsv(opts.file, account.id, mapping);
        console.log(`Found ${txns.length} valid rows.`);
        
        const res = insertTransactions(db, txns);
        console.log(`Imported: ${res.imported}`);
        console.log(`Skipped (Duplicate): ${res.skipped}`);
    });

  bank
    .command('reconcile')
    .requiredOption('--account <name>', 'Bank Account Name')
    .option('--from <date>', 'From Date')
    .option('--to <date>', 'To Date')
    .option('--preset <preset>', 'Date Preset', 'this_year')
    .action((opts: any) => {
        const db = getDb();
        const accounts = listAccounts(db);
        const account = accounts.find(a => a.name === opts.account);
        if (!account) {
            console.error(`Account ${opts.account} not found.`);
            process.exit(1);
        }
        
        const range = resolveDateRange(opts);
        console.log(`Reconciling ${account.name} for ${range.from} to ${range.to}...`);
        
        const matcher = new BankMatcher(db);
        const res = matcher.reconcile(account.id, range.from, range.to);
        
        console.log('--- Results ---');
        console.log(`Matched: ${res.matched}`);
        console.log(`Unmatched (Bank): ${res.unmatched}`);
        console.log(`Orphan (Expenses): ${res.orphans}`);
        
        const reportPath = generateReconciliationReport(db, account.id, range.from, range.to, process.cwd());
        console.log(`Report generated: ${reportPath}`);
    });
}
