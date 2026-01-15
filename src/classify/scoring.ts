import { AnalyzedMessage } from '../evidence/evidenceTypes';
import { ENGLISH_KEYWORDS, HEBREW_KEYWORDS, CURRENCY_SYMBOLS, UNSUBSCRIBE_PATTERNS } from './keywords';

export interface ScoreResult {
  score: number;
  label: 'EXPENSE' | 'TO_REVIEW' | 'NOT_EXPENSE';
  reasons: string[];
}

export function computeExpenseScore(msg: AnalyzedMessage): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const subjectLower = msg.subject.toLowerCase();
  const bodyLower = (msg.bodyFromHtml || '').toLowerCase(); // Fallback if body not present

  // +5 PDF attachment
  const hasPdf = msg.attachments.some(a => a.mimeType === 'application/pdf' || a.filename.toLowerCase().endsWith('.pdf'));
  if (hasPdf) {
    score += 5;
    reasons.push('Has PDF attachment');
  }

  // +3 Image attachment with keywords
  const hasImage = msg.attachments.some(a => a.mimeType.startsWith('image/'));
  if (hasImage) {
    const hasKwInFilename = msg.attachments.some(a => {
        const fn = a.filename.toLowerCase();
        return ENGLISH_KEYWORDS.some(k => fn.includes(k)) || HEBREW_KEYWORDS.some(k => fn.includes(k));
    });
    if (hasKwInFilename) {
        score += 3;
        reasons.push('Image attachment with invoice keyword');
    }
  }

  // +2 Subject keywords
  const subjKw = ENGLISH_KEYWORDS.some(k => subjectLower.includes(k)) || HEBREW_KEYWORDS.some(k => subjectLower.includes(k));
  if (subjKw) {
    score += 2;
    reasons.push('Subject contains keywords');
  }

  // +2 Body currency + amount
  // Simple regex for amount
  const amountRegex = /\d+[.,]\d+/;
  const hasCurrency = CURRENCY_SYMBOLS.some(c => bodyLower.includes(c.toLowerCase()));
  if (hasCurrency && amountRegex.test(bodyLower)) {
    score += 2;
    reasons.push('Body contains currency and amount');
  }

  // +2 Sender domain (Skipped for now as map is empty, but would go here)

  // -3 Newsletter
  const isNewsletter = UNSUBSCRIBE_PATTERNS.some(p => bodyLower.includes(p) || msg.snippet.toLowerCase().includes(p));
  if (isNewsletter) {
    score -= 3;
    reasons.push('Newsletter patterns detected');
  }
  
  // Thresholds
  let label: ScoreResult['label'] = 'NOT_EXPENSE';
  if (score >= 6) label = 'EXPENSE';
  else if (score >= 3) label = 'TO_REVIEW';

  // +3 Invoice Link (if no attachment evidence)
  // Only if score < 6 (not already likely) or to boost confidence
  if (msg.links && msg.links.length > 0) {
      const linkKeywords = ['invoice', 'receipt', 'bill', 'download', 'pdf', 'קבלה', 'חשבונית', 'תשלום'];
      const hasInvoiceLink = msg.links.some(l => {
          const lower = l.url.toLowerCase();
          return linkKeywords.some(k => lower.includes(k));
      });
      
      if (hasInvoiceLink) {
          score += 3;
          reasons.push('Invoice link detected');
          // If we have a link, we label TO_REVIEW at minimum if it's not already EXPENSE
          if (label === 'NOT_EXPENSE') label = 'TO_REVIEW';
      }
  }

  return { score, label, reasons };
}
