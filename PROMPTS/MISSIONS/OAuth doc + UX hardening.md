ROLE: IMPLEMENTER
TASK: Harden OAuth UX, documentation, and error handling.

GOALS
1) Update README.md:
   - Add “Real OAuth Setup” section with two subsections:
     - Google (Gmail) setup steps
     - Dropbox setup steps
   - Add copy/paste “.env” example lines
   - Add common errors section:
     - redirect_uri_mismatch (Google) and how to fix by exact match  [oai_citation:6‡Google Support](https://support.google.com/cloud/answer/15549257?hl=en&utm_source=chatgpt.com)
     - Dropbox redirect mismatch / consistency (authorize vs token exchange)  [oai_citation:7‡dropbox.tech](https://dropbox.tech/developers/using-oauth-2-0-with-offline-access?utm_source=chatgpt.com)
2) Update SPEC.md:
   - Record scopes used and why minimal
3) Add CLI help text:
   - expense auth gmail
   - expense auth dropbox
   - mention where tokens are stored
4) Add token sanity checks:
   - If token expired and refresh token exists, refresh automatically
   - If refresh fails, instruct to reauth

OUTPUT FORMAT
Return a single unified diff patch (git patch). No extra commentary.