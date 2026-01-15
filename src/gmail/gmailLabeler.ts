
import { GmailClient } from './gmailClient';
import { logger } from '../logging/logger';

export class GmailLabeler {
    private client: GmailClient;
    private labelCache: Record<string, string> = {}; // name -> id

    constructor() {
        // We reuse the existing client logic which loads tokens internally
        this.client = new GmailClient();
    }

    async ensureLabel(name: string): Promise<string | null> {
        if (this.labelCache[name]) return this.labelCache[name];

        try {
            const labels = await this.client.listLabels();
            const exist = labels.find(l => l.name === name);
            if (exist) {
                this.labelCache[name] = exist.id;
                return exist.id;
            }
            logger.info(`Creating Gmail label: ${name}`);
            const created = await this.client.createLabel(name);
            if (created && created.id) {
                this.labelCache[name] = created.id;
                return created.id;
            }
        } catch (e) {
            logger.error(`Failed to ensure label ${name}`, {error: e});
        }
        return null;
    }

    async applyLabel(gmailId: string, labelName: string): Promise<void> {
        const labelId = await this.ensureLabel(labelName);
        if (!labelId) return;
        try {
            await this.client.modifyMessage(gmailId, [labelId], []);
            logger.info(`Applied label ${labelName} to ${gmailId}`);
        } catch (e) {
            logger.error(`Failed to apply label ${labelName} to ${gmailId}`, {error: e});
        }
    }
}
