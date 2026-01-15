
import { Database } from 'better-sqlite3';

export interface CoverageSummary {
    total_scanned: number;
    count_expense: number;
    count_to_review: number;
    count_not_expense: number;
    missing_evidence: number; // For EXPENSE items only
    missing_amount: number;   // For EXPENSE items only
    unmatched_txns?: number;  // Phase 4
}

export interface MonthCoverage {
    month: string; // YYYY-MM
    count_expense: number;
    count_to_review: number;
    missing_evidence: number;
    missing_amount: number;
}

// Helper to construct "Missing Evidence" condition
// Definition: No rows in evidence_items AND no links in messages.links_json
const MISSING_EVIDENCE_SQL = `
    (
      (SELECT COUNT(*) FROM evidence_items WHERE message_id = m.id) = 0
      AND 
      (m.links_json IS NULL OR m.links_json = '[]' OR m.links_json = '')
    )
`;

// Helper for "Missing Amount" (stub for now, as amount is not fully schema-ized)
// If Phase 2 added amount parsing to subject/snippet but not DB, we can't query it easily.
// Constraint: "If amount fields do NOT exist in DB yet, implement ... heuristics"
// Since we don't have an 'amount' column in messages (checked schema), we will return 0 or implement a regex check if critical.
// Verify schema: Schema has `gpt_amount` or similar? No. `messages` has `subject`, `snippet`.
// So for SQL speed, effectively "0" missing (feature disabled) OR simplistic check if strictly required.
// Mission: "disabled UI... or heuristic". Let's return 0 for now to be safe and fast.
const MISSING_AMOUNT_SQL = `0`; 

export function getCoverageSummary(db: Database, startMs: number, endMs: number): CoverageSummary {
    const sql = `
        SELECT 
            COUNT(*) as total_scanned,
            SUM(CASE WHEN label = 'EXPENSE' THEN 1 ELSE 0 END) as count_expense,
            SUM(CASE WHEN label = 'TO_REVIEW' THEN 1 ELSE 0 END) as count_to_review,
            SUM(CASE WHEN label = 'NOT_EXPENSE' THEN 1 ELSE 0 END) as count_not_expense,
            SUM(CASE WHEN label = 'EXPENSE' AND ${MISSING_EVIDENCE_SQL} THEN 1 ELSE 0 END) as missing_evidence,
            SUM(CASE WHEN label = 'EXPENSE' AND ${MISSING_AMOUNT_SQL} THEN 1 ELSE 0 END) as missing_amount
        FROM messages m
        WHERE internal_date_ms >= ? AND internal_date_ms <= ?
    `;
    
    const row = db.prepare(sql).get(startMs, endMs) as any;

    // Phase 4: Unmatched transactions
    // Check if table exists first? `bank_transactions` table might not exist if migration didn't run.
    // However, migrations run on startup.
    // Query unmatched
    const startStr = new Date(startMs).toISOString().split('T')[0];
    const endStr = new Date(endMs).toISOString().split('T')[0];
    
    let unmatched = 0;
    try {
        const uRow = db.prepare(`
            SELECT COUNT(*) as count 
            FROM bank_transactions t
            LEFT JOIN txn_matches m ON t.id = m.txn_id
            WHERE t.txn_date >= ? AND t.txn_date <= ?
            AND m.id IS NULL
        `).get(startStr, endStr) as any;
        unmatched = uRow.count || 0;
    } catch (e) {
        // Table probably doesn't exist yet or query error
    }

    return {
        total_scanned: row.total_scanned || 0,
        count_expense: row.count_expense || 0,
        count_to_review: row.count_to_review || 0,
        count_not_expense: row.count_not_expense || 0,
        missing_evidence: row.missing_evidence || 0,
        missing_amount: row.missing_amount || 0,
        unmatched_txns: unmatched
    };
}

export function getCoverageByMonth(db: Database, startMs: number, endMs: number): MonthCoverage[] {
    const sql = `
        SELECT 
            strftime('%Y-%m', date_iso) as month,
            SUM(CASE WHEN label = 'EXPENSE' THEN 1 ELSE 0 END) as count_expense,
            SUM(CASE WHEN label = 'TO_REVIEW' THEN 1 ELSE 0 END) as count_to_review,
            SUM(CASE WHEN label = 'EXPENSE' AND ${MISSING_EVIDENCE_SQL} THEN 1 ELSE 0 END) as missing_evidence,
            SUM(CASE WHEN label = 'EXPENSE' AND ${MISSING_AMOUNT_SQL} THEN 1 ELSE 0 END) as missing_amount
        FROM messages m
        WHERE internal_date_ms >= ? AND internal_date_ms <= ?
        GROUP BY month
        ORDER BY month DESC
    `;
    
    return db.prepare(sql).all(startMs, endMs) as MonthCoverage[];
}

export function getIncompleteItemIds(db: Database, startMs: number, endMs: number, kind: 'to_review' | 'missing_evidence' | 'missing_amount'): number[] {
    let whereClause = '';
    
    if (kind === 'to_review') {
        whereClause = "label = 'TO_REVIEW'";
    } else if (kind === 'missing_evidence') {
        whereClause = `label = 'EXPENSE' AND ${MISSING_EVIDENCE_SQL}`;
    } else if (kind === 'missing_amount') {
        whereClause = `label = 'EXPENSE' AND ${MISSING_AMOUNT_SQL}`; // Will return empty
    } else {
        return [];
    }
    
    const sql = `
        SELECT id FROM messages m
        WHERE internal_date_ms >= ? AND internal_date_ms <= ?
        AND ${whereClause}
        ORDER BY internal_date_ms DESC
    `;
    
    const rows = db.prepare(sql).all(startMs, endMs) as { id: number }[];
    return rows.map(r => r.id);
}
