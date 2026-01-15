
export interface BankAccount {
    id: number;
    name: string;
    currency?: string;
    created_at_ms: number;
}

export interface BankTransaction {
    id: number;
    account_id: number;
    txn_date: string; // YYYY-MM-DD
    posted_date?: string;
    amount: number;
    currency?: string;
    description: string;
    merchant_hint?: string;
    raw_row_json: string;
    row_hash: string;
    created_at_ms: number;
}

export interface TxnMatch {
    id: number;
    txn_id: number;
    message_id: number;
    match_score: number;
    match_reason: string;
    created_at_ms: number;
}

export interface ReconciliationRun {
    id: number;
    account_id?: number;
    from_date?: string;
    to_date?: string;
    params_json?: string;
    created_at_ms: number;
}

export interface BankImportResult {
    total: number;
    imported: number;
    skipped: number;
    errors: string[];
}
