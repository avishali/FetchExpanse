
CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  currency TEXT,
  created_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  txn_date TEXT NOT NULL,
  posted_date TEXT,
  amount REAL NOT NULL,
  currency TEXT,
  description TEXT NOT NULL,
  merchant_hint TEXT,
  raw_row_json TEXT NOT NULL,
  row_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(row_hash),
  FOREIGN KEY(account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS txn_matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  txn_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,
  match_score INTEGER NOT NULL,
  match_reason TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  UNIQUE(txn_id, message_id),
  FOREIGN KEY(txn_id) REFERENCES bank_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  from_date TEXT,
  to_date TEXT,
  params_json TEXT,
  created_at_ms INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_date ON bank_transactions(account_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_txn_matches_txn_id ON txn_matches(txn_id);
CREATE INDEX IF NOT EXISTS idx_txn_matches_message_id ON txn_matches(message_id);
