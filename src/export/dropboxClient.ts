import { Dropbox } from 'dropbox';
import { config } from '../config';
import { logger } from '../logging/logger';
import fs from 'fs';
import path from 'path';
import { ensureDir } from '../util/fs';
import { getStoredDropboxTokens } from '../auth/dropboxAuth';

export class DropboxClient {
  private dbx: Dropbox;

  constructor() {
    this.dbx = new Dropbox({ 
        clientId: config.dropbox.appKey, 
        clientSecret: config.dropbox.appSecret 
    });
  }

  private loadTokens() {
      try {
          const tokens = getStoredDropboxTokens();
          
          if (tokens) {
              // Re-init with tokens
              this.dbx = new Dropbox({
                  clientId: config.dropbox.appKey,
                  clientSecret: config.dropbox.appSecret,
                  accessToken: tokens.access_token,
                  refreshToken: tokens.refresh_token,
              });
          } else {
              logger.warn('No Dropbox tokens found. Uploads will fail. Run `expense auth dropbox`.');
          }
      } catch (e) {
         logger.warn('Failed to load Dropbox tokens', {error: e});
      }
  }

  generateAuthUrl() {
      // Dropbox auth flow
      return "https://www.dropbox.com/oauth2/authorize?..."; // Stub
  }

  async upload(localPath: string, dropboxPath: string, options: { mock?: boolean } = {}) {
      if (options.mock) {
          logger.info(`MOCK: Uploading ${localPath} to Dropbox: ${dropboxPath}`);
          const mockDbxPath = path.join(config.dataDir, 'mock_dropbox', dropboxPath);
          ensureDir(path.dirname(mockDbxPath));
          fs.copyFileSync(localPath, mockDbxPath);
          return { path_display: dropboxPath };
      }
      
      this.loadTokens();

      const contents = fs.readFileSync(localPath);
      const res = await this.dbx.filesUpload({
          path: dropboxPath,
          contents,
          mode: { '.tag': 'overwrite' }
      });
      return res.result;
  }
}
