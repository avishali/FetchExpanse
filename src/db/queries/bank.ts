
import { Database } from 'better-sqlite3';
import { BankAccount, BankTransaction, TxnMatch } from '../../types/bank';

export function createAccount(db: Database, name: string, currency?: string): number {
    const stmt = db.prepare('INSERT INTO bank_accounts (name, currency, created_at_ms) VALUES (?, ?, ?)');
    const info = stmt.run(name, currency || null, Date.now());
    return info.lastInsertRowid as number;
}

export function listAccounts(db: Database): BankAccount[] {
    return db.prepare('SELECT * FROM bank_accounts ORDER BY id DESC').all() as BankAccount[];
}

export function insertTransactions(db: Database, txns: Omit<BankTransaction, 'id' | 'created_at_ms'>[]) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO bank_transactions 
        (account_id, txn_date, posted_date, amount, currency, description, merchant_hint, raw_row_json, row_hash, created_at_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    let imported = 0;
    const now = Date.now();
    
    const transaction = db.transaction((rows) => {
        for (const row of rows) {
            const result = stmt.run(
                row.account_id,
                row.txn_date,
                row.posted_date || null,
                row.amount,
                row.currency || null,
                row.description,
                row.merchant_hint || null,
                row.raw_row_json,
                row.row_hash,
                now
            );
            if (result.changes > 0) imported++;
        }
    });
    
    transaction(txns);
    return { imported, total: txns.length, skipped: txns.length - imported };
}

export function getTransactionsInDateRange(db: Database, accountId: number, fromDate: string, toDate: string): BankTransaction[] {
    return db.prepare(`
        SELECT * FROM bank_transactions 
        WHERE account_id = ? AND txn_date >= ? AND txn_date <= ?
        ORDER BY txn_date ASC
    `).all(accountId, fromDate, toDate) as BankTransaction[];
}

export function getUnmatchedTransactions(db: Database, accountId: number, fromDate: string, toDate: string): BankTransaction[] {
    return db.prepare(`
        SELECT t.* FROM bank_transactions t
        LEFT JOIN txn_matches m ON t.id = m.txn_id
        WHERE t.account_id = ? 
        AND t.txn_date >= ? AND t.txn_date <= ?
        AND m.id IS NULL
        ORDER BY t.txn_date ASC
    `).all(accountId, fromDate, toDate) as BankTransaction[];
}

export function getOrphanExpenses(db: Database, fromDate: string, toDate: string): any[] {
    // Return messages labeled EXPENSE that have NO match in txn_matches
    // Note: This query finds orphans globally, effectively. 
    // If we want per-account, it's tricky since an expense matched to Account A is not orphan for Account B?
    // Usually an expense is matched once.
    return db.prepare(`
        SELECT m.* FROM messages m
        LEFT JOIN txn_matches tm ON m.id = tm.message_id
        WHERE m.label = 'EXPENSE'
        AND m.date_iso >= ? AND m.date_iso <= ?
        AND tm.id IS NULL
        ORDER BY m.date_iso DESC
    `).all(fromDate, toDate) as any[];
}

export function getMatchedTransactions(db: Database, accountId: number, fromDate: string, toDate: string): any[] {
    // Join transactions with matches and messages
    return db.prepare(`
        SELECT 
            t.id as txn_id, t.txn_date, t.amount, t.description, t.currency,
            m.id as message_id, m.date_iso as msg_date, m.subject, m.from_domain, m.from_email,
            tm.match_score, tm.match_reason
        FROM bank_transactions t
        JOIN txn_matches tm ON t.id = tm.txn_id
        JOIN messages m ON tm.message_id = m.id
        WHERE t.account_id = ?
        AND t.txn_date >= ? AND t.txn_date <= ?
        ORDER BY t.txn_date ASC
    `).all(accountId, fromDate, toDate) as any[];
}

export function insertMatches(db: Database, matches: Omit<TxnMatch, 'id' | 'created_at_ms'>[]) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO txn_matches (txn_id, message_id, match_score, match_reason, created_at_ms)
        VALUES (?, ?, ?, ?, ?)
    `);
    
    const now = Date.now();
    let count = 0;
    const transaction = db.transaction((rows) => {
        for (const row of rows) {
             const res = stmt.run(row.txn_id, row.message_id, row.match_score, row.match_reason, now);
             if (res.changes > 0) count++;
        }
    });
    
    transaction(matches);
    return count;
}

export function clearMatches(db: Database, accountId: number, fromDate: string, toDate: string) {
    // Clear matches for transactions in this range for this account (to allow re-run)
    // We filter by txn_id belonging to account
    const stmt = db.prepare(`
        DELETE FROM txn_matches 
        WHERE txn_id IN (
            SELECT id FROM bank_transactions 
            WHERE account_id = ? AND txn_date >= ? AND txn_date <= ?
        )
    `);
    stmt.run(accountId, fromDate, toDate);
}
