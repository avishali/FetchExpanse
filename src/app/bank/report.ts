
import { Database } from 'better-sqlite3';
import { getMatchedTransactions, getUnmatchedTransactions } from '../../db/queries/bank';
import * as fs from 'fs';
import * as path from 'path';

export function generateReconciliationReport(db: Database, accountId: number, fromDate: string, toDate: string, outputDir: string): string {
    const matched = getMatchedTransactions(db, accountId, fromDate, toDate);
    const unmatched = getUnmatchedTransactions(db, accountId, fromDate, toDate);
    
    // We can also include orphans if desired, but mission said:
    // "Include: txn_id, txn_date, amount, description, match_status, matched_vendor..."
    // Orphans do not have txn_id. They are Expenses without transactions.
    // "Orphan expenses count" was requested in Summary.
    // For the CSV report, typically it lists the Bank Statement + Match Info.
    // If we want to list Orphans, they don't fit the schema well (txn_id is null).
    // I will export them in a separate section or file?
    // Mission says: "Include: txn_id... match_status (matched/unmatched)..."
    // This implies the report is Row-Per-Bank-Transaction.
    // So Orphans are NOT in this specific CSV.
    
    const lines = ['txn_id,date,amount,description,status,match_score,match_reason,matched_vendor,matched_message_id'];
    
    matched.forEach(m => {
        lines.push(`${m.txn_id},${m.txn_date},${m.amount},"${clean(m.description)}",MATCHED,${m.match_score},"${m.match_reason}","${clean(m.subject)}",${m.message_id}`);
    });
    
    unmatched.forEach(u => {
        lines.push(`${u.id},${u.txn_date},${u.amount},"${clean(u.description)}",UNMATCHED,,,,`);
    });
    
    const fileName = `reconciliation_${accountId}_${fromDate}_${toDate}.csv`;
    const outPath = path.join(outputDir, fileName);
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    fs.writeFileSync(outPath, lines.join('\n'));
    return outPath;
}

function clean(s: string): string {
    return (s || '').replace(/"/g, '""');
}
