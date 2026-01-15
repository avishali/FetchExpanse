import { DropboxAuth } from 'dropbox';
import { config, DATA_DIR } from '../config';
import { logger } from '../logging/logger';
import { startLocalCallbackServer } from './localCallbackServer';
import { ensureDir, writeJson } from '../util/fs';
import path from 'path';
import { exec } from 'child_process';
import fs from 'fs';

const TOKEN_PATH = path.join(DATA_DIR, 'tokens', 'dropbox_tokens.json');

export async function authorizeDropbox(options: { reauth?: boolean } = {}) {
  const { appKey, appSecret, redirectUri } = config.dropbox;

  if (!appKey || !appSecret) {
    throw new Error('Missing DROPBOX_APP_KEY or DROPBOX_APP_SECRET in .env');
  }

  // Dropbox SDK Auth
  const dbxAuth = new DropboxAuth({
    clientId: appKey,
    clientSecret: appSecret,
  });

  // Generate URL
  // "token_access_type": "offline" is key for refresh tokens
  // getAuthenticationUrl(redirectUri, state, authType, tokenAccessType, scope, includeGrantedScopes, usePKCE)
  // We need 'offline' for tokenAccessType
  // SDK signature: (redirectUri: string, state?: string, authType?: 'token' | 'code', tokenAccessType?: 'online' | 'offline', scope?: string[], includeGrantedScopes?: 'user' | 'team', usePKCE?: boolean)
  const authUrl = await dbxAuth.getAuthenticationUrl(
    redirectUri, 
    undefined, 
    'code', 
    'offline', 
    undefined, 
    undefined, 
    false // PKCE
  );

  logger.info('Opening browser for Dropbox authentication...');
  console.log('If browser does not open, visit this URL:', authUrl);

  // Open Browser
  exec(`open "${authUrl}" as string`); 

  try {
    const code = await startLocalCallbackServer(redirectUri);
    logger.info('Received auth code, exchanging for tokens...');

    const response = await dbxAuth.getAccessTokenFromCode(redirectUri, code);
    const tokens = response.result;

    // Save tokens
    ensureDir(path.dirname(TOKEN_PATH));
    writeJson(TOKEN_PATH, tokens);

    logger.info(`Dropbox tokens saved to ${TOKEN_PATH}`);
    return tokens;
  } catch (error) {
    logger.error('Dropbox authentication failed', { error });
    throw error;
  }
}

export function getStoredDropboxTokens() {
    try {
        if (fs.existsSync(TOKEN_PATH)) {
            return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
        }
    } catch (e) {
        return null;
    }
    return null;
}
