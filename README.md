# FetchExpanse

## Overview
FetchExpanse is a CLI tool designed to scan Gmail for 2025 invoice and receipt emails, classify them, download attachments or capture links, and export them to a structured Dropbox folder.

## Quick Start
1. Clone the repository.
2. Run `npm install`.
3. Copy `.env.example` to `.env` and fill in necessary details (or leave empty for mock mode).
4. Run `npm run build`.

## Commands

- **Doctor**: `npm run expense -- doctor` (Check env/auth)
- **Auth**:
  - `npm run expense -- auth gmail`
  - `npm run expense -- auth dropbox`
- **Scan**: `npm run expense -- scan [--year 2025] [--recall <normal|high>] [--include-spam] [--include-trash] [--limit N]`
- **Export**: `npm run expense -- export [--from ...] [--to ...] [--preset ...]`
- **Recurring**: `npm run expense -- recurring [--from ...] [--to ...] [--preset ...]`
- **Review**: `npm run expense -- review list` OR `mark --id <ID> --status <EXPENSE|NOT_EXPENSE>`

### Date Selection
You can use `--year` (default 2025), OR flexible ranges:
- `--preset ytd` (Year-to-date)
- `--preset last_12_months`
- `--from 2025-01-01 --to 2025-03-31`
*Note: If `--from` is provided without `--to`, it defaults to today.*

## Mock Mode
To run without real credentials, using local fixtures:
```bash
npm run expense -- scan --year 2025 --mock
npm run expense -- export --year 2025 --mock
npm run expense -- recurring --year 2025
```

## Real Auth Setup

### Google (Gmail)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and enable **Gmail API**.
3. Configure **OAuth Consent Screen** (User Type: External or Internal).
4. Create **OAuth Client ID** (Application type: Desktop App or Web Application).
   - **Important**: Authorized redirect URI must match exactly: `http://localhost:53682/oauth2callback`.
5. Copy Client ID and Secret to `.env`.

### Dropbox
1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps).
2. Create App (Scoped Access, App Folder recommended).
3. Add Permissions: `files.content.write`, `files.content.read`.
4. Add Redirect URI: `http://localhost:53682/dropboxcallback`.
5. Copy App Key and Secret to `.env`.

## Common Errors
- **Redirect URI Mismatch (Google)**: Ensure the URI in Cloud Console matches `http://localhost:53682/oauth2callback` exactly (no trailing slash changes, exact port).
- **Redirect URI Mismatch (Dropbox)**: Ensure the URI in App Console matches `http://localhost:53682/dropboxcallback`.
- **Token Expired**: Run `noun run expense -- auth gmail --reauth` or `dropbox` if refresh fails.

## Dropbox Folder Layout
Exports are organized by year/month and vendor:
`/Tax/2025/01 - January/VendorName/Filename.pdf`

 
 ## Completion Workflow ("When am I done?")
 
 1. **Run Scan** for desired period.
 2. **Review** all `TO_REVIEW` items.
 3. **Ensure** all `EXPENSE` items have evidence.
 4. **Check Dashboard** readiness badge:
    - **RED** → work remains.
    - **YELLOW** → optional cleanup (amounts not parsed).
    - **GREEN** → fully ready for accountant.
 5. **Export** accountant package.
 
 *Features:*
 - **Dashboard Completion Card**: Shows high-level status.
 - **Coverage Table**: Breakdown by month (clickable).
 - **Review Filters**: Filter by "Missing evidence" or "Missing amount".
## Link Capture (Phase 2.5)
FetchExpanse can automatically capture invoice links (PDFs or Screenshots) using Playwright.

### Setup
1. `npm install playwright` (Included in dependencies)
2. `npx playwright install` (Install browsers)

### Configuration (.env)
```bash
LINK_CAPTURE_ENABLED=true
LINK_CAPTURE_MAX_PER_MESSAGE=2
LINK_CAPTURE_TIMEOUT_MS=20000
LINK_CAPTURE_HEADLESS=true
```

## Bank Reconciliation (Phase 4)
Import CSV bank statements to cross-reference against your Gmail processing.

- **Import**: Support for arbitrary CSV layouts (configurable columns).
- **Match**: Detects matches based on Date, Amount, and Vendor across your Expense Inbox.
- **Reconciliation Report**: Export matched/unmatched transactions.

### Commands
- `npm run expense -- bank import --account "Poalim" --file ./statement.csv`
- `npm run expense -- bank reconcile --account "Poalim" --preset this_year`

## Accountant Pack (Phase 4.2)
Generate a comprehensive ZIP file for accounting handoff.

**Contents:**
- `README.txt`: Summary of period and currency.
- `summary.csv`: List of all expenses with evidence links.
- `expenses/`: Folder organized by Month -> Vendor -> PDF/Image.
- `bank_reconciliation/`: Reconciliation reports (if data exists).

**How to generate:**
- From Dashboard: Click "Accountant Pack" on the Completion Card.
- From Export Tab: Click "Generate Accountant Pack".


