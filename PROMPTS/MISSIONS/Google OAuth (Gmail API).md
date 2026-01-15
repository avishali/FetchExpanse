ROLE: IMPLEMENTER
TASK: Add Gmail OAuth setup flow and CLI command(s) to FetchExpanse so a user can authorize Gmail access locally and cache tokens securely.

CONTEXT
This is a local-first CLI app. We will use the Google OAuth “desktop/native app” loopback redirect approach (localhost callback) for a CLI. Google documents loopback redirect URIs for native apps.  [oai_citation:0‡Google for Developers](https://developers.google.com/identity/protocols/oauth2/native-app?utm_source=chatgpt.com)
We must configure OAuth consent screen and OAuth client in Google Cloud accordingly.  [oai_citation:1‡Google for Developers](https://developers.google.com/workspace/guides/configure-oauth-consent?utm_source=chatgpt.com)

GOALS
1) Implement command:
   - expense auth gmail
2) This command:
   - Starts a local HTTP server on localhost using the configured redirect URI port/path
   - Opens the system browser to Google’s auth URL
   - Receives the authorization code on the callback
   - Exchanges code for tokens
   - Saves tokens to DATA_DIR/tokens/gmail_tokens.json (gitignored)
3) Use minimal Gmail scopes:
   - https://www.googleapis.com/auth/gmail.readonly
   - (Optional later) gmail.modify if we add labeling; do NOT request it now.
4) Update expense doctor to:
   - Verify the Gmail env vars exist
   - Verify token cache exists (or report “not authorized”)
5) Make scan use tokens when not --mock.

REQUIRED ENV VARS (already in .env.example)
GMAIL_OAUTH_CLIENT_ID
GMAIL_OAUTH_CLIENT_SECRET
GMAIL_OAUTH_REDIRECT_URI (default http://localhost:53682/oauth2callback)

CONSOLE SETUP INSTRUCTIONS (must be added to README.md and SPEC.md)
Provide a step list, specifically:
A) Google Cloud Console → create/select project
B) Enable Gmail API for the project
C) Configure OAuth consent screen (External or Internal as appropriate)
D) Add scopes (gmail.readonly)
E) Create OAuth Client ID:
   - Type: Desktop app OR Web application (choose whichever matches implementation; MUST match redirect requirements)
   - Authorized redirect URI must match exactly the app’s redirect: http://localhost:53682/oauth2callback (or port/path user config)
Note: Redirect URI mismatches cause 400 errors; we must stress exact match.  [oai_citation:2‡Google Support](https://support.google.com/cloud/answer/15549257?hl=en&utm_source=chatgpt.com)

IMPLEMENTATION REQUIREMENTS
- Add new file(s) if needed:
  /src/auth/googleAuth.ts
  /src/auth/localCallbackServer.ts
- Do not add heavy frameworks. Use Node http module.
- Use googleapis OAuth2 client.
- Tokens must include refresh token if Google returns it; store JSON as returned.
- Add a “--reauth” flag to force new consent (prompt=consent).
- Log redaction: never print client secret or tokens.

ACCEPTANCE TESTS
1) npm run build passes
2) npm run expense -- doctor reports Gmail env var status
3) npm run expense -- auth gmail launches browser and saves token file
4) npm run expense -- scan --year 2025 (non-mock) fails gracefully if token missing and instructs to run auth

OUTPUT FORMAT
Return a single unified diff patch (git patch). No extra commentary.