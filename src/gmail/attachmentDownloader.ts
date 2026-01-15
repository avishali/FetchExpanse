import fs from 'fs';
import path from 'path';
import { ensureDir } from '../util/fs';
import { config } from '../config';

import { GmailClient } from './gmailClient';

const gmail = new GmailClient();

export async function downloadAttachment(
    messageId: string, 
    attachmentId: string, 
    filename: string,
    options: { mock?: boolean } = {}
): Promise<string> {
    const stagingDir = path.join(config.dataDir, 'staging', messageId);
    ensureDir(stagingDir);
    const dest = path.join(stagingDir, filename);

    if (options.mock) {
        // Stub content
        fs.writeFileSync(dest, `Mock content for ${filename}`);
        return dest;
    }

    // Real impl
    const content = await gmail.getAttachment(messageId, attachmentId);
    if (content) {
        fs.writeFileSync(dest, content);
    } else {
        throw new Error(`Empty content for attachment ${attachmentId}`);
    }
    return dest; 
}
