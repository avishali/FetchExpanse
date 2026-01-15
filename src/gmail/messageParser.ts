import { AnalyzedMessage, AttachmentMeta } from '../evidence/evidenceTypes';

export function parseMessage(gmailMsg: any): AnalyzedMessage {
  const payload = gmailMsg.payload;
  const headers = payload.headers || [];
  
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  const snippet = gmailMsg.snippet || '';
  const from = getHeader('From');
  const subject = getHeader('Subject');
  const date = new Date(parseInt(gmailMsg.internalDate) || getHeader('Date'));

  const attachments: AttachmentMeta[] = [];
  let bodyFromHtml = '';
  let bodyFromText = '';

  // Recursive MIME traversal
  function traverse(part: any) {
      if (!part) return;

      const mimeType = (part.mimeType || '').toLowerCase();
      
      // Decoded body
      let data = '';
      if (part.body && part.body.data) {
          data = Buffer.from(part.body.data, 'base64').toString('utf-8');
      }

      // 1. Content Extraction
      if (mimeType === 'text/html' && !bodyFromHtml) {
          bodyFromHtml = data;
      } else if (mimeType === 'text/plain' && !bodyFromText) {
          bodyFromText = data;
      }

      // 2. Attachment Extraction
      // Logic: It is an attachment if:
      // - It has a filename
      // - AND (has attachmentId OR is an inline attachment we want to consider)
      if (part.filename) {
          // Normalize filename
          const filename = part.filename;
          
          let attachmentId = part.body?.attachmentId;
          const size = part.body?.size || 0;

          // Some parts have filename but no attachmentId immediately (e.g. if data is inline)
          // But for Gmail API 'full', usually attachmentId is present for real attachments.
          // We capture it if it has an ID.
             if (attachmentId) {
                attachments.push({
                    attachmentId: attachmentId,
                    filename,
                    mimeType,
                    size
                });
             }
      }

      // 3. Recursion
      if (part.parts) {
          for (const sub of part.parts) traverse(sub);
      }
  }

  // Start traversal
  if (payload.parts) {
      // Multipart message
      traverse(payload);
  } else {
      // Single part message (e.g. just text/html)
      traverse(payload);
  }

  // Fallback: If no HTML body found, use Text body wrapped
  if (!bodyFromHtml && bodyFromText) {
      bodyFromHtml = `<pre>${bodyFromText}</pre>`;
  }

  // Link Extraction
  const links: { url: string; anchorText?: string; context?: string }[] = [];
  
  // 1. Structured <a> tags
  const aTagRegex = /<a\s+(?:[^>]*?\s+)?href=["'](https?:\/\/[^"']+)["'][^>]*>(.*?)<\/a>/gis;
  let match;
  while ((match = aTagRegex.exec(bodyFromHtml)) !== null) {
      const url = match[1].split('#')[0].trim(); // Normalize: remove hash, trim
      const anchor = match[2].replace(/<[^>]*>?/gm, '').trim().substring(0, 100); // Strip tags from inside anchor
      
      // Get context (approx 50 chars before and after)
      const start = Math.max(0, match.index - 50);
      const end = Math.min(bodyFromHtml.length, match.index + match[0].length + 50);
      const snippet = bodyFromHtml.substring(start, end).replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();

      links.push({ url, anchorText: anchor, context: snippet });
  }

  // 2. Bare URLs via regex (dedupe with <a> tags)
  const bareUrlRegex = /(https?:\/\/[^\s<>"']+)/g;
  const bareMatches = bodyFromHtml.replace(/<a\s+[^>]*>.*?<\/a>/gis, '').match(bareUrlRegex);
  if (bareMatches) {
      for (const url of bareMatches) {
          const cleanUrl = url.split('#')[0].trim();
          if (!links.some(l => l.url === cleanUrl)) {
              links.push({ url: cleanUrl });
          }
      }
  }

  return {
      id: gmailMsg.id,
      threadId: gmailMsg.threadId,
      date,
      from,
      subject,
      snippet,
      bodyFromHtml, 
      attachments,
      links: links // Deduplication handled during extraction
  };
}
