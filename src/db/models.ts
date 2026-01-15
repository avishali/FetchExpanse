export interface Message {
  id: number;
  gmail_message_id: string;
  thread_id: string;
  internal_date_ms: number;
  date_iso: string;
  from_email: string;
  from_domain: string;
  subject: string;
  snippet: string;
  label: string; // 'EXPENSE', 'TO_REVIEW', 'NOT_EXPENSE'
  score: number;
  reasons_json: string;
  status: string; // 'NEW', 'PROCESSED', 'ERROR'
  created_at: string;
}

export interface EvidenceItem {
  id: number;
  message_id: number;
  kind: string; // 'ATTACHMENT', 'LINK_CAPTURE', 'LINK_STUB'
  filename: string;
  mime_type: string;
  sha256: string;
  size_bytes: number;
  local_path: string;
  source_url?: string;
  created_at: string;
}

export interface Export {
  id: number;
  evidence_id: number;
  destination: string; // 'DROPBOX'
  dropbox_path: string;
  sha256: string;
  exported_at: string;
}

export interface Vendor {
  id: number;
  canonical_name: string;
  aliases_json: string;
}

export interface RecurringPattern {
  id: number;
  vendor: string;
  year: number;
  months_json: string; 
  count_months: number;
  created_at: string;
}
