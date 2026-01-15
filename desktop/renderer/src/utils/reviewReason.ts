
import { formatAmount } from './displayFormat';

export function getReviewReason(message: any): string | null {
    if (!message) return null;

    // 1. PDF Attached
    // Note: item.has_attachment is usually 0 or 1.
    if (message.has_attachment) {
        return "PDF attached";
    }

    // 2. Link Detected
    if (message.links_json) {
        try {
            const links = JSON.parse(message.links_json);
            if (links && links.length > 0) {
                return "Invoice link detected";
            }
        } catch (e) { }
    }

    // 3. Amount Missing
    const amount = formatAmount(message.subject + ' ' + message.snippet);
    if (!amount) {
        return "Amount missing";
    }

    // 4. Login Required (Heuristic)
    const text = (message.subject + ' ' + message.snippet).toLowerCase();
    if (text.includes("login") || text.includes("sign in") || text.includes("verify account")) {
        return "Login required";
    }

    // 5. Keyword Match (from existing reasons_json or manual check)
    if (message.reasons_json) {
        try {
            const reasons = JSON.parse(message.reasons_json);
            if (Array.isArray(reasons) && reasons.length > 0) {
                // Return the first interesting reason that isn't generic
                const interesting = reasons.find(r => !r.includes("generic") && !r.includes("model"));
                if (interesting) return interesting;
            }
        } catch (e) { }
    }
    
    // Fallback
    if (message.label === 'TO_REVIEW') return "Needs review";

    return null;
}
