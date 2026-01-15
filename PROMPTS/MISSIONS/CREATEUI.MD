ROLE: IMPLEMENTER
MODE: Local repo on Mac. Existing FetchExpanse CLI + SQLite + OAuth + pipeline already implemented. Current UI (localhost) may exist, but we are now building a FULL Electron desktop app UI.
OUTPUT REQUIREMENT: Add an Electron app (Mac-focused) that provides a full GUI for scan/review/export with date range selection, while reusing existing core logic (DB, pipeline steps, exporters).
STYLE REQUIREMENT: TypeScript 5.x. ESLint + Prettier. Strong typing. Minimal new dependencies. No secrets/tokens printed. No server required.
DO NOT: Rewrite core pipeline. Do not introduce a hosted backend. Do not break existing CLI commands.

GOAL
Create “FetchExpanse Desktop” (Electron) that:
1) Runs as a desktop app on macOS
2) Lets user:
   - Configure date range (presets + custom)
   - Run Scan (Gmail) with progress
   - Review items (TO_REVIEW, EXPENSE, NOT_EXPENSE)
   - Edit decision (status/vendor/category)
   - View evidence (open local file; show preview when possible)
   - Run Export to Dropbox
   - View recurring expenses report
   - Run Doctor (env + auth status)
   - Run Auth (Gmail + Dropbox) by opening browser and completing localhost callback (existing flow), with status indicator in UI
3) Uses existing SQLite DB and existing pipeline steps, so CLI and Desktop share the same logic.

ARCHITECTURE (MUST FOLLOW)
- Keep core logic in /src as-is (db/, pipeline/, gmail/, export/, recurring/, etc.)
- Add a desktop layer under /desktop that uses Electron main + renderer.
- Use Electron IPC to call “core” functions from renderer safely.
- Avoid bundler complexity initially: use Vite for renderer OR Electron Forge OR electron-builder. Choose ONE approach and implement cleanly.
- No React required; but you MAY use React if you can keep it simple. If you choose React, use Vite + React + TS. If not, do vanilla TS + simple DOM.

RECOMMENDED STACK (CHOOSE THIS UNLESS STRONGLY JUSTIFIED)
- electron
- electron-builder (packaging)
- Vite for renderer (fast dev)
- Renderer framework: React + TS (recommended for UI speed) OR vanilla TS
- Use a simple component library only if necessary; avoid heavy dependencies.

NEW FILE TREE (ADD)
/desktop/main/main.ts
/desktop/main/ipc.ts
/desktop/main/window.ts
/desktop/main/preload.ts
/desktop/shared/ipcTypes.ts
/desktop/renderer/index.html
/desktop/renderer/src/main.tsx (or main.ts if vanilla)
/desktop/renderer/src/App.tsx
/desktop/renderer/src/styles.css
/desktop/renderer/src/state/store.ts (simple state)
/desktop/renderer/src/pages/Dashboard.tsx
/desktop/renderer/src/pages/Scan.tsx
/desktop/renderer/src/pages/ReviewList.tsx
/desktop/renderer/src/pages/ReviewDetail.tsx
/desktop/renderer/src/pages/Export.tsx
/desktop/renderer/src/pages/Recurring.tsx
/desktop/renderer/src/pages/Settings.tsx
/desktop/renderer/src/components/DateRangePicker.tsx
/desktop/renderer/src/components/ProgressBar.tsx
/desktop/renderer/src/components/Table.tsx
/desktop/renderer/src/components/Badge.tsx
/desktop/renderer/src/components/Toast.tsx
/desktop/renderer/src/components/ConfirmDialog.tsx

PACKAGE.JSON CHANGES (MUST)
Add scripts:
- "desktop:dev": runs electron + renderer dev server
- "desktop:build": builds renderer and electron main/preload and packages
- "desktop:pack": creates a .dmg (mac) or zipped app
Keep existing CLI scripts unchanged.

Add build config for electron-builder:
- appId: com.fetchexpanse.app
- productName: FetchExpanse
- files: include dist core + desktop main/preload + renderer build output
- mac target: dmg
- Do not code sign (leave instructions only)

SECURITY MODEL (MUST)
- contextIsolation: true
- nodeIntegration: false
- preload exposes a minimal API via contextBridge
- All DB and filesystem access must be in main process only
- Renderer must never read env secrets directly
- NEVER log tokens or client secrets

IPC API (MUST IMPLEMENT)
Define typed IPC channels in /desktop/shared/ipcTypes.ts and implement in main/ipc.ts.

Renderer calls:
- getAppInfo() -> { version, dataDir, dbPath, auth: { gmail: boolean, dropbox: boolean } }
- doctor() -> { ok: boolean, checks: [...] } (no secrets)
- openExternal(url) -> void (for auth pages if needed)
- authGmailStart() -> { ok: boolean } (calls existing “auth gmail” core function or spawns it)
- authDropboxStart() -> { ok: boolean }
- scan(range, options) -> async progress events + final summary
- listMessages(range, filter, search, pagination) -> { rows, total }
- getMessageDetail(id) -> { message, evidence[], decision? }
- setDecision(messageId, { status, vendorOverride?, category? }) -> { ok }
- export(range, options) -> progress + summary
- recurring(range) -> { reportPath, items[] }
- openEvidence(evidenceId) -> opens file with system default
- revealInFinder(evidenceId) -> shows file in Finder (mac)

PROGRESS EVENTS (MUST)
Use IPC event streaming:
- "scan:progress": { stage, current, total, message? }
- "export:progress": { stage, current, total, message? }
- "task:done": { taskId, ok, summary }

DATE RANGE SELECTION (MUST)
Implement DateRangePicker with:
- Presets: this_year, last_year, ytd, last_12_months
- Custom from/to (YYYY-MM-DD)
- Use the same resolveDateRange logic as CLI (create or reuse shared module in /src/types/dateRange.ts)
- Store current range in app state and reuse across pages.

UI REQUIREMENTS (MVP BUT POLISHED)
- Left sidebar nav: Dashboard, Scan, Review, Export, Recurring, Settings
- Dashboard:
  - Active range
  - Counts: EXPENSE / TO_REVIEW / NOT_EXPENSE
  - Auth status badges for Gmail/Dropbox
  - Buttons: Run Scan, Open Review
- Scan page:
  - Range selector
  - Start scan button
  - Progress bar + live log lines (redacted)
  - Results summary
- Review list:
  - Filter tabs: TO_REVIEW, EXPENSE, NOT_EXPENSE, ALL
  - Search box (vendor/from/subject)
  - Table with sortable date
  - Row click opens detail
- Review detail:
  - Metadata, reasons, score
  - Evidence list: open / reveal in Finder
  - Decision form: status radio, vendor/category inputs, Save, Next TO_REVIEW
- Export page:
  - Range selector
  - Dry-run checkbox
  - Export button
  - Progress + result with “Open Dropbox base path note” (no URLs required)
- Settings page:
  - Show DATA_DIR, DROPBOX_BASE_PATH (safe values)
  - Button: Run Doctor
  - Buttons: Auth Gmail / Auth Dropbox
  - Show token presence status (boolean only)

REUSE CORE LOGIC (IMPORTANT)
- Do NOT re-implement Gmail, Dropbox, pipeline, DB.
- In main process, import and call existing functions from /src.
If core functions are not “callable” cleanly (currently CLI-only), extract minimal wrappers:
- /src/app/operations.ts exporting:
  - runDoctor()
  - runAuthGmail()
  - runAuthDropbox()
  - runScan(range, opts, onProgress)
  - runExport(range, opts, onProgress)
  - getReviewList(...)
  - getReviewDetail(...)
  - setDecision(...)
  - runRecurring(...)
This must be a thin layer around existing modules.

MOCK MODE (KEEP)
- Desktop should support --mock equivalent via a toggle in Settings OR auto-detect missing env and suggest mock.
- It must not crash if env missing; it must show “Doctor” results and actionable guidance.

DOCS (MUST)
Update README.md with:
- Desktop dev instructions
- Desktop build instructions
- Safety notes (localhost auth, token storage, no secrets printed)

DEFINITION OF DONE
- npm run build (CLI) still succeeds
- npm run desktop:dev launches the Electron app
- Electron app can:
  - show doctor status
  - run auth (browser opens, tokens saved, status updates)
  - run scan with progress and write to DB
  - show review list + detail
  - save decisions to DB
  - open evidence file
  - run export with progress
  - run recurring report
- No tokens or secrets printed in console logs
- Packaging command produces a Mac .dmg (unsigned is fine)

OUTPUT FORMAT
Return a single unified diff patch (git patch) for all changes. No extra commentary.

BEGIN.