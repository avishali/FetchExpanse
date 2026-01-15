ROLE: IMPLEMENTER
MODE: Local repo on Mac + empty GitHub repo named "FetchExpanse"
OUTPUT REQUIREMENT: Create a complete, runnable TypeScript CLI project + spec. Commit-ready structure. No server.
STYLE REQUIREMENT: TypeScript 5.x. ESLint + Prettier. Strong typing. Minimal dependencies. Clear file boundaries.
DO NOT: Add unrelated features. Do not invent credentials. Do not commit tokens. Do not require a backend service.

MISSION
Bootstrap the “FetchExpanse” repository from empty to a working MVP CLI that:
- Scans Gmail for 2025 invoice/receipt emails (Hebrew + English)
- Downloads attachments and/or captures invoice links (PDF/screenshot) into local staging
- Exports to Dropbox folder tree organized by month + vendor
- Classifies uncertain emails as TO_REVIEW
- Tracks state in local SQLite (idempotent, safe re-runs)
- Detects recurring monthly expenses (heuristics)
- Is extensible via pipeline steps

EXECUTION RULES
- Create all folders/files listed in FILE TREE exactly.
- Initialize Node project, scripts, TypeScript config, ESLint, Prettier.
- Add .gitignore to exclude data/tokens/logs.
- Provide a working CLI with `npm run build` and `npm run expense -- --help`.
- Implement a `--mock` mode using local fixtures so the CLI works without real Gmail/Dropbox credentials.
- Implement `expense doctor` to validate env vars and show setup guidance.
- Implement OAuth flows as scaffolding (actual auth requires user secrets).
- Provide output as a single unified diff patch OR as complete file contents per file (FILE: path). No extra commentary.

TECH STACK
- Runtime: Node.js (LTS)
- Language: TypeScript 5.x
- CLI: commander
- Gmail API: googleapis
- Dropbox: dropbox SDK
- DB: better-sqlite3
- Link capture: Playwright (optional for MVP; implement interface + stub if heavy, but keep stable)
- Logging: simple structured logger (own code)
- Testing: optional (can add later), but include at least basic “mock” fixtures.

FILE TREE (CREATE EXACTLY)
/SPEC.md
/README.md
/.gitignore
/.env.example
/package.json
/tsconfig.json
/.eslintrc.cjs
/.prettierrc
/src/index.ts
/src/cli/commands.ts
/src/cli/args.ts
/src/config.ts
/src/logging/logger.ts
/src/db/db.ts
/src/db/migrations/001_init.sql
/src/db/models.ts
/src/gmail/gmailClient.ts
/src/gmail/gmailQueries.ts
/src/gmail/messageParser.ts
/src/gmail/attachmentDownloader.ts
/src/evidence/evidenceTypes.ts
/src/evidence/linkExtractor.ts
/src/evidence/linkCapture.ts
/src/classify/scoring.ts
/src/classify/keywords.ts
/src/vendors/vendorNormalize.ts
/src/export/dropboxClient.ts
/src/export/pathRules.ts
/src/export/exporter.ts
/src/pipeline/pipeline.ts
/src/pipeline/steps.ts
/src/recurring/recurringDetector.ts
/src/report/manifest.ts
/src/util/retry.ts
/src/util/fs.ts
/src/util/hash.ts
/data/fixtures/mock_messages_2025.json

PROJECT SCRIPTS (package.json must include)
- "build": "tsc -p tsconfig.json"
- "lint": "eslint . --ext .ts"
- "format": "prettier -w ."
- "expense": "node dist/index.js"
- "dev": "ts-node src/index.ts" (only if ts-node is installed; otherwise omit)
- Optional: "prepare": for husky (do not add unless needed)

README.md (MUST INCLUDE)
- What this tool does
- Quick start steps
- Mock mode example commands
- Real auth setup overview (high-level, not secret values)
- Dropbox folder layout

ENV (MUST INCLUDE)
Create .env.example with:
GMAIL_OAUTH_CLIENT_ID=
GMAIL_OAUTH_CLIENT_SECRET=
GMAIL_OAUTH_REDIRECT_URI=http://localhost:53682/oauth2callback
DROPBOX_APP_KEY=
DROPBOX_APP_SECRET=
DROPBOX_REDIRECT_URI=http://localhost:53682/dropboxcallback
DROPBOX_BASE_PATH=/Tax
DATA_DIR=./data
LOG_LEVEL=info

GITIGNORE (MUST INCLUDE)
Ignore:
node_modules/
dist/
data/**
!.data/fixtures/
*.log
.env

SPEC.md (MUST INCLUDE)
A) Overview + user story
B) Architecture (pipeline steps + module responsibilities)
C) SQLite schema (tables, columns, indexes)
D) Gmail discovery: exact query strings for 2025
E) Classification rules (score/thresholds + reasons)
F) Evidence capture rules (attachments + link capture + fallback)
G) Dropbox export layout + filename rules
H) CLI contract (commands, flags, examples)
I) Security notes (scopes, token storage, redaction)
J) Future extensions list

GMAIL QUERIES (IMPLEMENT IN src/gmail/gmailQueries.ts)
buildQueries(year:number): string[] must return:
- in:anywhere after:YYYY/01/01 before:(YYYY+1)/01/01 has:attachment (invoice OR receipt OR "tax invoice" OR "payment receipt")
- in:anywhere after:YYYY/01/01 before:(YYYY+1)/01/01 has:attachment (חשבונית OR קבלה OR "חשבונית מס" OR "חשבונית מס/קבלה" OR זיכוי)
- in:anywhere after:YYYY/01/01 before:(YYYY+1)/01/01 ("invoice" OR "receipt" OR חשבונית OR קבלה) -has:attachment
- in:anywhere after:YYYY/01/01 before:(YYYY+1)/01/01 filename:pdf

CLASSIFICATION (IMPLEMENT)
computeExpenseScore(...) => { score, label, reasons }
Rules:
+5 PDF attachment present
+3 image attachment (png/jpg/jpeg/heic) and filename contains invoice/receipt keywords (EN/HE)
+2 subject contains keywords (EN/HE)
+2 body contains currency symbol (₪) or (ILS/NIS/USD/EUR) AND amount-like regex
+2 sender domain matches known vendor map (starts empty)
-3 newsletter/unsubscribe heavy patterns
Thresholds:
>=6 EXPENSE
3..5 TO_REVIEW
<=2 NOT_EXPENSE
Persist reasons.

PIPELINE STEPS (IMPLEMENT)
- scan: Gmail scan (or mock fixtures), parse, classify, store message rows
- evidence: download attachments / capture links to staging
- export: upload to Dropbox (or in mock mode, export to local folder ./data/mock_dropbox to simulate)
All steps idempotent: use hashes and DB state to avoid duplicates.

DB (IMPLEMENT)
Use better-sqlite3 with migrations.
Tables minimum:
messages(id PK, gmail_message_id UNIQUE, thread_id, internal_date_ms, date_iso, from_email, from_domain, subject, snippet, label, score, reasons_json, status, created_at)
evidence_items(id PK, message_id FK, kind, filename, mime_type, sha256, size_bytes, local_path, source_url, created_at)
exports(id PK, evidence_id FK, destination, dropbox_path, sha256, exported_at)
vendors(id PK, canonical_name UNIQUE, aliases_json)
decisions(id PK, message_id FK, status, vendor_override, category, decided_at)
recurring_patterns(id PK, vendor, year, months_json, count_months, created_at)

CLI COMMANDS (IMPLEMENT)
expense doctor
expense scan --year 2025 [--limit N] [--dry-run] [--mock]
expense export --year 2025 [--dry-run] [--mock]
expense review list --year 2025
expense review mark --id <dbId> --status <EXPENSE|NOT_EXPENSE|TO_REVIEW> [--vendor "X"] [--category "Y"]
expense recurring --year 2025

MOCK MODE (MUST WORK)
- ./data/fixtures/mock_messages_2025.json contains at least 6 example messages:
  - 2 with PDF attachment metadata
  - 1 with Hebrew keywords
  - 1 with invoice link (url)
  - 1 newsletter-like
  - 1 ambiguous (TO_REVIEW)
In mock mode:
- Gmail client reads fixture JSON
- Dropbox exporter writes files to ./data/mock_dropbox following the same path rules
- Evidence downloads can be stubbed by writing small placeholder files with deterministic content/hashes

LINK CAPTURE
If Playwright is included:
- Implement captureToPdfOrScreenshot(url, outDir) using chromium
If not included yet:
- Implement a stub that saves an .url.txt file containing the URL and mark evidence kind as LINK_STUB
Keep interface stable.

DEFINITION OF DONE
- Fresh clone + `npm install` + `npm run build` succeeds
- `npm run expense -- doctor` runs and reports missing env vars clearly
- `npm run expense -- scan --year 2025 --mock` populates DB
- `npm run expense -- export --year 2025 --mock` produces local mock dropbox tree
- `npm run expense -- recurring --year 2025` outputs recurring report and writes ./data/reports/recurring_2025.json
- All created files are committed (except ignored ones)

NOW DO THE WORK
1) Create scaffolding files (package.json, tsconfig, eslint, prettier, gitignore, env example)
2) Create SPEC.md + README.md
3) Implement DB + migrations
4) Implement pipeline + CLI
5) Implement mock fixtures and ensure mock mode works end-to-end
6) Ensure build passes and commands run

OUTPUT FORMAT
- Provide a single unified diff patch for the entire repo OR output full contents per file labeled with FILE: path.
- Do not include explanations outside of those outputs.

BEGIN.