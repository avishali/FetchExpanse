
/**
 * Resolves a deterministic vendor name from a message object.
 * Priority:
 * 1) vendor_override (user manual override)
 * 2) canonical alias (TODO: lookup from map if provided)
 * 3) cleaned display name
 * 4) cleaned domain
 */
export function resolveVendorName(message: any): string {
    if (!message) return 'Unknown';

    // 1. Override
    if (message.vendor_override) {
        return message.vendor_override;
    }

    // 2. Alias Mapping (Placeholder for now, can be extended)
    // if (aliases[message.from_email]) return aliases[message.from_email];

    // 3. Cleaned Display Name
    const fromHeader = message.from_header || message.from_name || '';
    const cleanedName = cleanDisplayName(fromHeader);
    if (cleanedName) return cleanedName;

    // 4. Fallback to Domain
    if (message.from_domain) {
        return cleanDomain(message.from_domain);
    }

    return 'Unknown Vendor';
}

function cleanDisplayName(header: string): string | null {
    if (!header) return null;

    // Remove email portion <...>
    let cleaning = header.replace(/<[^>]*>/g, '').trim();
    
    // Remove quotes
    cleaning = cleaning.replace(/^["']|["']$/g, '');

    // Strip generic prefixes/suffixes words (case insensitive)
    const ignoreWords = ['no-reply', 'noreply', 'do-not-reply', 'billing', 'notifications', 'support', 'alert', 'receipts', 'invoices', 'automatic', 'service', 'team'];
    
    // Split into words
    let words = cleaning.split(/\s+/).filter(w => w.length > 0);
    
    // Filter out ignore words, but careful not to remove the *only* word if it matches (e.g. "Support" from "Support Inc")? 
    // Actually mission says "Strip ...".
    
    words = words.filter(w => !ignoreWords.includes(w.toLowerCase()));

    // Remove formatting noise like brackets
    words = words.map(w => w.replace(/[\[\]\(\)\{\}]/g, ''));
    
    if (words.length === 0) return null;

    // Title Case
    const result = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    
    return result;
}

function cleanDomain(domain: string): string {
    if (!domain) return '';
    
    let d = domain.toLowerCase();
    
    // Strip TLD (simple approach: remove last segment)
    const parts = d.split('.');
    
    // If > 2 parts (e.g. mail.google.com), maybe keep 'google'? 
    // Common heuristic: second to last part is usually the name (google.com -> google, bbc.co.uk -> bbc?)
    // This is complex for global TLDs, but for 2 seconds UX:
    // Just take the first part of the domain usually works for clean domains, 
    // but subdomains like 'notifications.stripe.com' -> 'notifications'? No.
    // 'stripe.com' -> 'stripe'.
    
    // Let's take the SLD (Second Level Domain) if possible.
    if (parts.length >= 2) {
        // e.g. amazon.com -> amazon
        // e.g. billing.uber.com -> uber? OR billing?
        // Mission rules: "Remove TLD and subdomains". 
        // Heuristic: take the part before the TLD?
        // Let's try to grab the "main" part. 
        // Usually the 2nd to last part for .com, .net, .org.
        
        const candidate = parts[parts.length - 2];
        if (candidate.length > 2) {
             return candidate.charAt(0).toUpperCase() + candidate.slice(1);
        }
    }
    
    return d.split('.')[0].charAt(0).toUpperCase() + d.split('.')[0].slice(1);
}
