
CREATE TABLE IF NOT EXISTS evidence_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    url_original TEXT NOT NULL,
    url_resolved TEXT,
    vendor_domain TEXT,
    anchor_text TEXT,
    context_snippet TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL, -- DETECTED | DOWNLOADING | DOWNLOADED | FAILED | NEEDS_LOGIN | UNSUPPORTED
    http_status INTEGER,
    content_type TEXT,
    filename TEXT,
    file_path TEXT,
    file_sha256 TEXT,
    failure_reason TEXT,
    FOREIGN KEY(message_id) REFERENCES messages(id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_links_msg ON evidence_links(message_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_status ON evidence_links(status);
