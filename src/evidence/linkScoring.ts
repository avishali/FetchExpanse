
import { AnalyzedMessage } from './evidenceTypes';

export interface ScoredLink {
    url: string;
    score: number;
    reason?: string;
}

const INVOICE_KEYWORDS = [
    'invoice', 'receipt', 'billing', 'download', 'pdf', 'order', 'payment', 'bill',
    'חשבונית', 'קבלה', 'תשלום', 'חיוב', 'עסקה', 'מס', 'הזמנה', 'זיכוי'
];

const BLOCK_SUBSTRINGS = [
    'unsubscribe', 'login', 'signin', 'register', 'account', 'preferences',
    'policy', 'terms', 'help', 'support', 'facebook', 'twitter', 'instagram', 'linkedin',
    'tiktok', 'youtube', 'doubleclick', 'googleadservices', 'utm_'
];

// Heuristic scoring
// Heuristic scoring
export function pickInvoiceLinks(msg: AnalyzedMessage, maxLinks: number): { url: string; anchorText?: string; context?: string }[] {
    if (!msg.links || msg.links.length === 0) return [];

    const scored = msg.links.map(link => {
        let score = 0;
        const lowercaseUrl = link.url.toLowerCase();
        const lowercaseAnchor = (link.anchorText || '').toLowerCase();
        const lowercaseContext = (link.context || '').toLowerCase();

        // 1. Penalty for tracking/ads/social
        if (BLOCK_SUBSTRINGS.some(s => lowercaseUrl.includes(s) || lowercaseAnchor.includes(s))) {
            score -= 50;
        }

        // 2. Bonus for keywords in URL
        if (INVOICE_KEYWORDS.some(k => lowercaseUrl.includes(k))) {
            score += 20;
        }

        // 3. Bonus for keywords in Anchor Text (High weight)
        if (INVOICE_KEYWORDS.some(k => lowercaseAnchor.includes(k))) {
            score += 40;
        }

        // 4. Bonus for keywords in context (Medium weight)
        if (INVOICE_KEYWORDS.some(k => lowercaseContext.includes(k))) {
            score += 15;
        }

        // 5. File extension bonus
        if (lowercaseUrl.endsWith('.pdf')) score += 30;
        if (lowercaseUrl.includes('/pdf/')) score += 20;

        return { ...link, score };
    });

    // Filter positive scores and sort
    const top = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxLinks);

    return top.map(({ score, ...rest }) => rest);
}

