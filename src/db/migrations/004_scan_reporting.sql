
CREATE TABLE IF NOT EXISTS scan_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT NOT NULL, -- 'NORMAL', 'HIGH_RECALL'
    range_start INTEGER NOT NULL,
    range_end INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    status TEXT DEFAULT 'COMPLETED', -- 'COMPLETED', 'FAILED', 'TRUNCATED'
    total_found INTEGER DEFAULT 0,
    total_inserted INTEGER DEFAULT 0,
    is_truncated INTEGER DEFAULT 0,
    truncation_reason TEXT
);

CREATE TABLE IF NOT EXISTS scan_run_buckets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    bucket_name TEXT NOT NULL,
    query TEXT,
    found_count INTEGER DEFAULT 0,
    inserted_count INTEGER DEFAULT 0,
    is_truncated INTEGER DEFAULT 0,
    FOREIGN KEY(run_id) REFERENCES scan_runs(id) ON DELETE CASCADE
);
