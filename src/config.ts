import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  gmail: {
    clientId: process.env.GMAIL_OAUTH_CLIENT_ID || '',
    clientSecret: process.env.GMAIL_OAUTH_CLIENT_SECRET || '',
    redirectUri: process.env.GMAIL_OAUTH_REDIRECT_URI || 'http://localhost:53682/oauth2callback',
  },
  dropbox: {
    appKey: process.env.DROPBOX_APP_KEY || '',
    appSecret: process.env.DROPBOX_APP_SECRET || '',
    redirectUri: process.env.DROPBOX_REDIRECT_URI || 'http://localhost:53682/dropboxcallback',
    basePath: process.env.DROPBOX_BASE_PATH || '/Tax',
  },
  dataDir: process.env.DATA_DIR || './data',
  logLevel: process.env.LOG_LEVEL || 'info',
  linkCapture: {
    enabled: process.env.LINK_CAPTURE_ENABLED === 'true',
    maxPerMessage: parseInt(process.env.LINK_CAPTURE_MAX_PER_MESSAGE || '2'),
    timeoutMs: parseInt(process.env.LINK_CAPTURE_TIMEOUT_MS || '20000'),
    navTimeoutMs: parseInt(process.env.LINK_CAPTURE_NAV_TIMEOUT_MS || '15000'),
    userAgent: process.env.LINK_CAPTURE_USER_AGENT || 'FetchExpanse/1.0',
    headless: process.env.LINK_CAPTURE_HEADLESS !== 'false', // Default true
    blocklist: (process.env.LINK_CAPTURE_BLOCKLIST_DOMAINS || 'facebook.com,instagram.com,tiktok.com,twitter.com,youtube.com,linkedin.com').split(','),
  }
};

export const DATA_DIR = path.resolve(config.dataDir);
export const DB_PATH = path.join(DATA_DIR, 'expense.db');
