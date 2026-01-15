import { google } from 'googleapis';
import { config } from '../config';
import { logger } from '../logging/logger';
import { readJson } from '../util/fs';
import path from 'path';
import fs from 'fs';

// Mock types
export interface GmailMessageMinimal {
  id: string;
  threadId: string;
}

export class GmailClient {
  private oauth2Client;
  private gmail;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.gmail.clientId,
      config.gmail.clientSecret,
      config.gmail.redirectUri
    );
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  private loadTokens() {
     try {
         // We might need to import TOKEN_PATH or just reconstruct it to avoid circular deps if any
         // or import from simple util. 
         // For now, let's look at config.
         const tokenPath = path.join(config.dataDir, 'tokens', 'gmail_tokens.json');
         // We need fs. readJson is async or sync? util/fs says readJson uses fs.readFileSync, so it is sync.
         // But readJson throws if missing. We can use fs.existsSync check logic inside readJson using try/catch
         // or just import fs.
         // Let's rely on importing fs.
         const fs = require('fs');
         if (fs.existsSync(tokenPath)) {
            const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            this.oauth2Client.setCredentials(tokens);
         } else {
             logger.warn('No Gmail tokens found. calls calling API will fail. Run `expense auth gmail`.');
         }
     } catch(e) {
         logger.warn('Failed to load access tokens', {error: e});
     }
  }

  async listMessages(query: string, options: { mock?: boolean, includeSpamTrash?: boolean, limit?: number } = {}): Promise<GmailMessageMinimal[]> {
    if (options.mock) {
      logger.info('MOCK: Listing messages from fixtures');
      // ...
      const fixturePath = path.resolve(config.dataDir, 'fixtures', 'mock_messages_2025.json');
      const messages = readJson<any[]>(fixturePath);
      // Respect limit in mock too
      return messages.slice(0, options.limit).map(m => ({ id: m.id, threadId: m.threadId }));
    }
    
    // Ensure tokens loaded
    this.loadTokens();

    const allMessages: GmailMessageMinimal[] = [];
    let pageToken: string | undefined = undefined;
    let pageCount = 0;

    // Real impl loop
    do {
        // Stop if we reached the limit
        if (options.limit && allMessages.length >= options.limit) {
            break;
        }

        // We use explicit any for res to avoid 'implicitly has type any' error if types are missing
        const res: any = await this.gmail.users.messages.list({
            userId: 'me',
            q: query,
            includeSpamTrash: options.includeSpamTrash,
            pageToken: pageToken,
            maxResults: 100 // Default max is usually 100, can go up to 500
        });
        
        const pageMessages = res.data.messages || [];
        allMessages.push(...pageMessages
            .filter((m: any) => m.id && m.threadId)
            .map((m: any) => ({ id: m.id!, threadId: m.threadId! }))
        );
        
        pageToken = res.data.nextPageToken || undefined;
        pageCount++;
        logger.debug(`Fetched page ${pageCount} for query. Total so far: ${allMessages.length}`);

    } while (pageToken && (!options.limit || allMessages.length < options.limit));

    // Slice to exact limit if we over-fetched slightly
    if (options.limit && allMessages.length > options.limit) {
        return allMessages.slice(0, options.limit);
    }
    
    return allMessages;
  }

  async getMessage(id: string, options: { mock?: boolean } = {}): Promise<any> {
    if (options.mock) {
       logger.info(`MOCK: Getting message ${id}`);
       const fixturePath = path.resolve(config.dataDir, 'fixtures', 'mock_messages_2025.json');
       const messages = readJson<any[]>(fixturePath);
       return messages.find(m => m.id === id);
    }
    // Ensure tokens loaded
    this.loadTokens();

    const res = await this.gmail.users.messages.get({
      userId: 'me',
      id,
      format: 'full',
    });
    return res.data;
  }
  
  generateAuthUrl(): string {
     return this.oauth2Client.generateAuthUrl({
         access_type: 'offline',
         scope: [
             'https://www.googleapis.com/auth/gmail.readonly',
             'https://www.googleapis.com/auth/gmail.modify'
         ]
     });
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer | null> {
      this.loadTokens();
      try {
          const res = await this.gmail.users.messages.attachments.get({
              userId: 'me',
              messageId,
              id: attachmentId
          });
          
          if (res.data.data) {
              return Buffer.from(res.data.data, 'base64');
          }
          return null;
      } catch (e) {
          logger.error(`Failed to fetch attachment ${attachmentId} for message ${messageId}`, e);
          return null;
      }
  }

  // Label Management
  async listLabels(): Promise<any[]> {
      this.loadTokens();
      const res = await this.gmail.users.labels.list({ userId: 'me' });
      return res.data.labels || [];
  }

  async createLabel(name: string): Promise<any> {
      this.loadTokens();
      const res = await this.gmail.users.labels.create({
          userId: 'me',
          requestBody: {
              name,
              labelListVisibility: 'labelShow',
              messageListVisibility: 'show'
          }
      });
      return res.data;
  }

  async modifyMessage(messageId: string, addLabelIds: string[] = [], removeLabelIds: string[] = []): Promise<void> {
      this.loadTokens();
      await this.gmail.users.messages.modify({
          userId: 'me',
          id: messageId,
          requestBody: {
              addLabelIds,
              removeLabelIds
          }
      });
  }
}
