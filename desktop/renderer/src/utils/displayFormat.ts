
/**
 * Heuristics to clean up vendor names from email headers.
 * e.g. "Uber Receipts <receipts@uber.com>" -> "Uber Receipts"
 *      "service@paypal.com" -> "Paypal"
 */
export function formatVendor(fromHeader: string): string {
    if (!fromHeader) return 'Unknown Vendor';

    // Remove email part <...>
    let cleaning = fromHeader.replace(/<.*>/, '').trim();

    // Remove quotes
    cleaning = cleaning.replace(/^["']|["']$/g, '');

    // If it's just an email left, take the domain or user
    if (cleaning.includes('@')) {
        const [user, domain] = cleaning.split('@');
        // If user is 'no-reply' or generic, use domain
        if (['no-reply', 'noreply', 'service', 'info', 'billing'].includes(user.toLowerCase())) {
            const domainName = domain.split('.')[0];
            return domainName.charAt(0).toUpperCase() + domainName.slice(1);
        }
        return user.charAt(0).toUpperCase() + user.slice(1);
    }
    
    // Capitalize if it looks like all lowercase
    if (cleaning === cleaning.toLowerCase()) {
        return cleaning.replace(/\b\w/g, l => l.toUpperCase());
    }

    return cleaning;
}

/**
 * Attempt to extract a currency amount from text (subject + snippet).
 * Very basic regex for now.
 */
export function formatAmount(text: string): string | null {
    if (!text) return null;
    
    // Look for $123.45 or 123.45 USD or 123.45 ILS or ₪123.45
    // Priority to currency symbols
    const symbolRegex = /([$€£₪])\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/;
    const symbolMatch = text.match(symbolRegex);
    if (symbolMatch) {
         return `${symbolMatch[1]}${symbolMatch[2]}`;
    }

    // Look for suffix currency
    const suffixRegex = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(USD|EUR|ILS|NIS)/i;
    const suffixMatch = text.match(suffixRegex);
    if (suffixMatch) {
        return `${suffixMatch[1]} ${suffixMatch[2].toUpperCase()}`;
    }

    return null;
}

/**
 * formatted dates
 */
export function formatDate(isoString: string): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric' // Jan 15, 2025
    });
}
