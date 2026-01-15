import { DropboxClient } from './dropboxClient';
import { getDropboxPath } from './pathRules';
import { EvidenceItem } from '../db/models';
import { AnalyzedMessage } from '../evidence/evidenceTypes';
import { getDb } from '../db/db';

const dbx = new DropboxClient();

export async function exportEvidence(evidence: EvidenceItem, date: Date, vendor: string, options: { mock?: boolean } = {}) {
    const remotePath = getDropboxPath(date, vendor, evidence.filename);
    
    await dbx.upload(evidence.local_path, remotePath, options);
    
    // Record export
    getDb().prepare(`
        INSERT INTO exports (evidence_id, destination, dropbox_path, sha256)
        VALUES (?, 'DROPBOX', ?, ?)
    `).run(evidence.id, remotePath, evidence.sha256);
}
