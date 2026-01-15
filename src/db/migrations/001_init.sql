CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmail_message_id TEXT UNIQUE NOT NULL,
  thread_id TEXT,
  internal_date_ms INTEGER,
  date_iso TEXT,
  from_email TEXT,
  from_domain TEXT,
  subject TEXT,
  snippet TEXT,
  label TEXT,
  score INTEGER,
  reasons_json TEXT,
  status TEXT DEFAULT 'NEW',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER,
  kind TEXT,
  filename TEXT,
  mime_type TEXT,
  sha256 TEXT,
  size_bytes INTEGER,
  local_path TEXT,
  source_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS exports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  evidence_id INTEGER,
  destination TEXT,
  dropbox_path TEXT,
  sha256 TEXT,
  exported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(evidence_id) REFERENCES evidence_items(id)
);

CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  canonical_name TEXT UNIQUE NOT NULL,
  aliases_json TEXT
);

CREATE TABLE IF NOT EXISTS decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER,
  status TEXT,
  vendor_override TEXT,
  category TEXT,
  decided_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(message_id) REFERENCES messages(id)
);

CREATE TABLE IF NOT EXISTS recurring_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor TEXT,
  year INTEGER,
  months_json TEXT,
  count_months INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
