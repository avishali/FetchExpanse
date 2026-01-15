
/**
 * High-Recall Gmail MIME Traversal & Body Extraction
 * 
 * Goals:
 * 1. Extract HTML or Text with high recall (recursive).
 * 2. Handle nested multipart/related and cid: inline images.
 * 3. Collect diagnostics to explain empty states.
 */

export interface BodyDiagnostics {
    foundHtmlParts: number;
    foundTextParts: number;
    foundCidImages: number;
    blockedRemoteImages: number;
    reasonIfEmpty?: 'NO_BODY_PARTS' | 'ONLY_ATTACHMENTS' | 'CID_IMAGES_UNRESOLVED' | 'REMOTE_IMAGES_BLOCKED' | 'UNSUPPORTED_MIME' | 'HTML_STRIPPED_BY_SANITIZER';
}

export interface BodyResult {
    html: string;
    text: string;
    diag: BodyDiagnostics;
}

export function extractEmailBody(payload: any): BodyResult {
    const diag: BodyDiagnostics = {
        foundHtmlParts: 0,
        foundTextParts: 0,
        foundCidImages: 0,
        blockedRemoteImages: 0
    };

    if (!payload) {
        diag.reasonIfEmpty = 'NO_BODY_PARTS';
        return { html: '', text: '', diag };
    }

    // Maps Content-ID -> Data URL
    const inlineImages = new Map<string, string>();
    
    // Candidates
    let bestHtml = '';
    let bestText = '';

    // 1. Decoder
    const decode = (data: string): string => {
        if (!data) return '';
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        return Buffer.from(base64, 'base64').toString('utf-8');
    };

    // 2. Recursive Walker
    const walk = (part: any) => {
        // Skip attachments
        if (part.filename && part.filename.length > 0) {
            // Note: Some inline images have filenames but are strictly layout. 
            // However, typical "attachments" we want to skip.
            // But cid images often have filenames too.
            // We check Content-Disposition.
            const disposition = part.headers?.find((h: any) => h.name.toLowerCase() === 'content-disposition')?.value?.toLowerCase();
            if (disposition?.includes('attachment')) return;
        }

        const mimeType = part.mimeType?.toLowerCase() || '';

        // Handle Content-ID (Inline Images)
        const contentIdHeader = part.headers?.find((h: any) => h.name.toLowerCase() === 'content-id');
        if (contentIdHeader && part.body?.data) {
            // Remove < and > wrapper
            const cid = contentIdHeader.value.replace(/^<|>$/g, '');
            if (cid) {
                diag.foundCidImages++;
                // Create Data URL
                const imgData = decode(part.body.data); 
                // Wait, body.data is declared as base64url. 
                // For images, we want base64 for the data URI.
                // Gmail API body.data IS base64url. 
                // We need standard base64 for data URI.
                const base64 = part.body.data.replace(/-/g, '+').replace(/_/g, '/');
                inlineImages.set(cid, `data:${mimeType};base64,${base64}`);
            }
        }

        // Handle Body Content
        if (mimeType === 'text/html' && part.body?.data) {
            diag.foundHtmlParts++;
            const content = decode(part.body.data);
            // Heuristic: Prefer larger bodies (skip signature-only or empty divs)
            if (content.length > bestHtml.length) {
                bestHtml = content;
            }
        } else if (mimeType === 'text/plain' && part.body?.data) {
            diag.foundTextParts++;
            const content = decode(part.body.data);
            if (content.length > bestText.length) {
                bestText = content;
            }
        }

        // Recursion
        // 1. multipart/*
        if (part.parts) {
            part.parts.forEach(walk);
        }
        
        // 2. message/rfc822 (Embedded Email)
        // These often wrap the payload in part.body where body is the whole raw message? 
        // Or sometimes they have 'parts' directly if parsed?
        // Gmail API usually parses message/rfc822 into nested parts if 'format=full' was used recursively, 
        // but typically it stops at top level. 
        // If we strictly rely on `parts`, we are good.
    };

    // Start Parse
    // Top level payload behaves like a part
    walk(payload);

    // 3. Post-Processing: CID Substitution
    if (bestHtml && inlineImages.size > 0) {
        // Regex to replace src="cid:..."
        // Simple case insensitive replace
        bestHtml = bestHtml.replace(/src=["']cid:([^"']+)["']/gi, (match, cid) => {
            if (inlineImages.has(cid)) {
                return `src="${inlineImages.get(cid)}"`;
            }
            return match; // Keep broken cid if missing
        });
    }

    // 4. Diagnostics: Check for unresolved CIDs
    if (bestHtml && bestHtml.includes('cid:')) {
        // Technically strict check would regex again.
        // If we still have 'cid:', it means we missed some.
        // We'll mark diag. But we don't fail content.
        // reasonIfEmpty will be set below if content is actually empty.
    }

    // 5. Diagnostics: Check for Remote Images
    if (bestHtml) {
        // Count http/https images
        const remoteMatches = bestHtml.match(/src=["']http/gi);
        if (remoteMatches) {
            diag.blockedRemoteImages = remoteMatches.length;
        }
    }

    // 6. Determine Final Reason if Empty
    if (!bestHtml && !bestText) {
        if (diag.foundHtmlParts === 0 && diag.foundTextParts === 0) {
             // Did we see attachments? We skipped them in walk(), but we can infer:
             // If payload had parts but we ignored them all, likely ONLY_ATTACHMENTS.
             // (Simple check: if payload has parts/filename but no html/text found)
             const hasParts = payload.parts && payload.parts.length > 0;
             const hasMainBodyFromWalker = false; // We didn't track "skipped" parts.
             
             // Simplest heuristic:
             diag.reasonIfEmpty = hasParts ? 'ONLY_ATTACHMENTS' : 'NO_BODY_PARTS';
        } else {
             // We found parts but content was 0 length?
             diag.reasonIfEmpty = 'NO_BODY_PARTS';
        }
    }

    // NOTE: 'CID_IMAGES_UNRESOLVED' or 'REMOTE_IMAGES_BLOCKED' are hints, 
    // unless the body was ONLY images and they are all blocked/unresolved, 
    // effectively rendering it empty.
    // If we have HTML text, we show it (with hints). 
    // If HTML is ONLY <img src="cid:.."> and it failed, it might look empty.
    // For now, we only populate reasonIfEmpty if BOTH html and text are falsy.

    return { 
        html: bestHtml || '', 
        text: bestText || '', 
        diag 
    };
}
