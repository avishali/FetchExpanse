ROLE: IMPLEMENTER
TASK: Add Dropbox OAuth setup flow and CLI command(s) to FetchExpanse so a user can authorize Dropbox access locally and cache tokens securely.

CONTEXT
We use Dropbox OAuth 2.0 Authorization Code flow. Dropbox supports OAuth code flow and explains offline access / refresh tokens.  [oai_citation:3‡developers.dropbox.com](https://developers.dropbox.com/oauth-guide?utm_source=chatgpt.com)
For offline/refresh, use token_access_type=offline in the authorize URL and exchange the code at /oauth2/token.
Dropbox requires redirect_uri consistency between authorize and token exchange.  [oai_citation:4‡dropbox.tech](https://dropbox.tech/developers/using-oauth-2-0-with-offline-access?utm_source=chatgpt.com)

GOALS
1) Implement command:
   - expense auth dropbox
2) This command:
   - Starts local callback server at DROPBOX_REDIRECT_URI
   - Opens browser to Dropbox authorize URL
   - Receives authorization code
   - Exchanges code for:
     - access token (short-lived) + refresh token (if offline)
   - Saves token data to DATA_DIR/tokens/dropbox_tokens.json (gitignored)
3) Ensure exporter uses these tokens when not --mock.
4) Update expense doctor to:
   - Verify Dropbox env vars exist
   - Verify token cache exists (or report “not authorized”)

REQUIRED ENV VARS (already in .env.example)
DROPBOX_APP_KEY
DROPBOX_APP_SECRET
DROPBOX_REDIRECT_URI (default http://localhost:53682/dropboxcallback)
DROPBOX_BASE_PATH (default /Tax)

DROPBOX CONSOLE SETUP INSTRUCTIONS (must be added to README.md and SPEC.md)
Provide step list:
A) Dropbox App Console → Create app
   - Choose “Scoped access”
   - Choose “Full Dropbox” if you want to write anywhere, or “App folder” if you want restrictions (recommend “App folder” for safety unless user requests full).
B) Permissions (scopes):
   - files.content.write
   - files.content.read (optional if needed)
   - sharing.write (optional only if we implement “create shared link”)
C) Add Redirect URI exactly matching DROPBOX_REDIRECT_URI (http://localhost:53682/dropboxcallback)
Dropbox OAuth guide references this flow.  [oai_citation:5‡developers.dropbox.com](https://developers.dropbox.com/oauth-guide?utm_source=chatgpt.com)

IMPLEMENTATION REQUIREMENTS
- Add new file(s) if needed:
  /src/auth/dropboxAuth.ts
  (Reuse /src/auth/localCallbackServer.ts from Google prompt)
- Prefer official dropbox SDK, but direct fetch to /oauth2/token is acceptable if simpler.
- Must request offline access:
  - token_access_type=offline
- Must persist refresh token if provided.
- Never log secrets/tokens.
- Add “--reauth” flag to force new consent.

ACCEPTANCE TESTS
1) npm run build passes
2) npm run expense -- doctor reports Dropbox env var status
3) npm run expense -- auth dropbox launches browser and saves token file
4) npm run expense -- export --year 2025 (non-mock) fails gracefully if token missing and instructs to run auth

OUTPUT FORMAT
Return a single unified diff patch (git patch). No extra commentary.