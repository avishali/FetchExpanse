# FetchExpanse Specification (v1.0)

## Overview
FetchExpanse is a local desktop application that scans a Gmail account for invoices and receipts, classifies them, and exports them to Dropbox for accounting purposes. It focuses on privacy (local processing) and robustness (offline-first, idempotent).

## Technology Stack
- **Runtime**: Node.js (LTS) + Electron
- **Language**: TypeScript 5.x
- **Frontend**: React + Vite (Renderer Process)
- **Backend**: Electron Main Process (Node.js)
- **Database**: SQLite (`better-sqlite3`)
- **APIs**: Gmail API, Dropbox SDK

---

## Architecture

### 1. Process Model
- **Main Process**: Hosting the Node.js backend. Responsible for:
    - Database access (`better-sqlite3`)
    - File system operations (saving tokens, logs, staging files)
    - OAuth flows (Gmail, Dropbox)
    - Core pipelines (Scan, Export, Recurring)
    - IPC Handler registration
- **Renderer Process**: Hosting the React UI. Responsible for:
    - UI rendering (Dashboard, Scan, Review, Export, Recurring)
    - Managing Global State (`DateRangeContext`)
    - Sending IPC commands to Main

### 2. IPC Contract (Strict)
Communication is strictly typed via `ipcTypes.ts`.

| Channel | Input | Description |
|---------|-------|-------------|
| `scan` | `{ range, options: { recall, includeSpam, includeTrash } }` | Triggers Gmail scan & classification |
| `getReviewList` | `{ range: DateRangeArgs, status }` | Fetches filtered messages for review |
| `export` | `{ range: DateRangeArgs, options }` | Exports approved evidence to Dropbox |
| `getRecurring` | `{ range: DateRangeArgs }` | Calculates recurring expense patterns |
| `auth:gmail` | `void` | Opens system browser for Gmail OAuth |
| `auth:dropbox` | `void` | Opens system browser for Dropbox OAuth |

### 3. Data Model (SQLite)
The database is the single source of truth.

**`messages`**
- `id`: PK
- `gmail_message_id`: UNIQUE (Gmail ID)
- `label`: 'EXPENSE', 'TO_REVIEW', 'NOT_EXPENSE'
- `status`: 'NEW', 'REVIEWED', 'EXPORTED'
- `date_iso`: ISO Date string
- ...metadata (subject, from, snippet)

**`evidence_items`**
- `id`: PK
- `message_id`: FK
- `kind`: 'ATTACHMENT' | 'LINK_PDF' | 'LINK_SCREENSHOT' | 'LINK_HTML_SNAPSHOT'
- `filename`: logical filename
- `local_path`: Path to file in `userData/data/staging`
- `attachment_id`: Gmail Attachment ID (for downloads)
- `source_url`: Original URL (for captured links)
- `sha256`: Content hash

**`exports`**
- Tracks what has been uploaded to Dropbox to prevent duplicates.

---

## Key Features

### 1. Flexible Date Selection
Users can select a global date range applied to all operations:
- **Presets**: `this_year`, `last_year`, `ytd`, `last_12_months`
- **Custom**: Start Date (`--from`) to End Date (`--to`)
- **Global Context**: In functionality, changing the date in the "Scan" tab updates the "Review" and "Export" views automatically.

### 2. Real Authentication
- **OAuth2**: 
    - Uses a local express-like server (`http/net` module) to listen for callbacks on port `53682`.
    - Tokens are encrypted/stored in `userData/data/tokens/`.
    - Auto-refreshes tokens using the SDKs.
- **Dropbox**: 
    - Redirect URI: `http://localhost:53682/dropboxcallback`
- **Gmail**: 
    - Redirect URI: `http://localhost:53682/oauth2callback`

### 3. Robust Scanning (Self-Healing)
- **Real Downloads**: Fetches PDF/Image content using `GmailClient.getAttachment`.
- **Self-Healing**: If a scan record exists but is missing the `attachment_id` (migrated data), the system automatically re-fetches the message metadata from Gmail to recover the ID and download the file.
- **Pagination**: Automatically loops through Gmail results pages. High Recall mode REQUIRES `--limit` to prevent unbounded scans.

### 4. Link Capture (Playwright)
- **Automated Capture**: Visits "invoice-likely" links found in emails.
- **Output**: Captures as PDF (if printable) or PNG Screenshot.
- **Safety**: Strict per-link timeouts, max links per message, and domain blocklists.
- **Idempotency**: Avoids re-capturing the same URL for the same message.

### 5. Native Modules
- **`better-sqlite3`**: Recompiled for the specific Electron ABI version using `electron-builder install-app-deps`.

---
 
 ## Phase 3 — Completeness & Confidence
 
 ### Definitions
 - **TO_REVIEW**: Message labeled `TO_REVIEW`. Needs manual decision.
 - **EXPENSE**: Message labeled `EXPENSE`. Confirmed as business expense.
 - **NOT_EXPENSE**: Message labeled `NOT_EXPENSE`. Ignored.
 - **Missing Evidence**: An `EXPENSE` item with no PDF/image attachments AND no captured link evidence.
 - **Missing Amount**: An `EXPENSE` item with no detected amount (feature gated).
 
 ### Readiness Scoring Rules (Authoritative)
 - **RED**:
   - Any `TO_REVIEW` item exists.
   - OR any `EXPENSE` item is **Missing Evidence**.
 - **YELLOW**:
   - No `TO_REVIEW` items.
   - No **Missing Evidence**.
   - **Missing Amount** exists (only if amount feature enabled).
 - **GREEN**:
   - No `TO_REVIEW`.
   - No **Missing Evidence**.
   - No **Missing Amount** (if enabled).
 
 *If amount tracking is not enabled, GREEN requires only no TO_REVIEW and no Missing Evidence.*
 
 ### Coverage Model
 - Coverage is computed per month and per selected period.
 - Coverage table aggregates counts and readiness per month.
 - Clicking a month deep-links to Review with filters applied.
 
 ### Explicit Non-Goals
 - Phase 3 does NOT change scan logic.
 - Phase 3 does NOT infer new expenses.
 - Phase 3 does NOT block export (it informs readiness).
 
 ---

## CLI Mapping
The app also supports a CLI (`npm run expense --`) which shares the *exact same core logic* as the Electron app.

| Action | Command |
|--------|---------|
| Scan | `npm run expense -- scan --preset ytd` |
| Export | `npm run expense -- export --from 2025-01-01` |
| Auth | `npm run expense -- auth dropbox` |
| Doctor | `npm run expense -- doctor` |

---

## Phase 4 — Bank Statement Cross-Check

### Goal
To verify that all expense documentation is accounted for by cross-referencing against an authoritative bank statement (CSV).

### Scope
- **Database**: New tables `bank_accounts`, `bank_transactions`, `txn_matches`.
- **Import**: Configurable CSV parser for bank statements.
- **Reconciliation Engine**: Deterministic matching logic (Date, Amount, Vendor).
- **UI**: New "Bank" tab for account management, import wizard, and unmatched/matched views.
- **Reporting**: Exportable reconciliation CSV report.

### Database Schema (Additions)
- `bank_accounts`: `id`, `name`, `currency`.
- `bank_transactions`: `txn_date`, `amount`, `description`, `row_hash` (idempotency key).
- `txn_matches`: `txn_id`, `message_id`, `match_score`, `match_reason`.

### Matching Scoring
Candidates are selected from `EXPENSE` messages within +/- 7 days.
- **Exact Amount**: +60 points.
- **Amount within 1.00**: +40 points.
- **Exact Date**: +20 points.
- **Vendor/Domain Match**: +20-30 points.
- **Threshold**: Matches > 70 points are auto-linked.

### Workflows
1. **Import**: User uploads CSV -> Maps columns -> Transactions stored (duplicates skipped via hash).
2. **Reconcile**: User clicks "Reconcile" -> Engine runs (idempotent, clears previous auto-matches in range) -> Results displayed.
3. **Review**:
   - **Matched**: Validated expenses.
   - **Unmatched Bank**: Transactions missing an invoice (Action: Search or upload manually).
   - **Orphan Expenses**: Invoices with no bank charge (Action: Did I pay? Wrong date?).

### Constraints
- No changes to Gmail scan logic.
- Matching is strictly deterministic (no fuzzy AI).
- Import is resilient to messy CSVs (header skipping, flexible dates).

---

## Future Roadmap
- **Advanced Classification**: Use LLM or better heuristics for text body analysis.
- **Multi-Account**: Support multiple Gmail accounts.
