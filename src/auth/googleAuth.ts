import { google } from 'googleapis';
import { config, DATA_DIR } from '../config';
import { logger } from '../logging/logger';
import { startLocalCallbackServer } from './localCallbackServer';
import { ensureDir, writeJson } from '../util/fs';
import path from 'path';
import { exec } from 'child_process';

const TOKEN_PATH = path.join(DATA_DIR, 'tokens', 'gmail_tokens.json');
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

export async function authorizeGmail(options: { reauth?: boolean } = {}) {
  const { clientId, clientSecret, redirectUri } = config.gmail;
  
  if (!clientId || !clientSecret) {
    throw new Error('Missing GMAIL_OAUTH_CLIENT_ID or GMAIL_OAUTH_CLIENT_SECRET in .env');
  }

  const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Generate URL
  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: options.reauth ? 'consent' : undefined
  });

  logger.info('Opening browser for authentication...');
  console.log('If browser does not open, visit this URL:', authUrl);
  
  // Open Browser (Mac specific based on user OS, but generic 'open' is good for Mac)
  exec(`open "${authUrl}"`);

  // Wait for callback
  try {
    const code = await startLocalCallbackServer(redirectUri);
    logger.info('Received auth code, exchanging for tokens...');
    
    const { tokens } = await client.getToken(code);
    
    // Save tokens
    ensureDir(path.dirname(TOKEN_PATH));
    writeJson(TOKEN_PATH, tokens);
    
    logger.info(`Tokens saved to ${TOKEN_PATH}`);
    return tokens;
  } catch (error) {
    logger.error('Authentication failed', { error });
    throw error;
  }
}

export function getStoredGmailTokens() {
    try {
        const fs = require('fs');
        if (fs.existsSync(TOKEN_PATH)) {
            return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        }
    } catch (e) {
        return null;
    }
    return null;
}
