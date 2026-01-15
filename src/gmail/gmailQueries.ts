import { DateRange } from '../types/dateRange';
import moment from 'moment';

export type RecallMode = 'normal' | 'high';

export interface QueryOptions {
  recall?: RecallMode;
  includeSpam?: boolean;
  includeTrash?: boolean;
}

export function buildQueries(range: DateRange, options: QueryOptions = {}): string[] {
  // Gmail format: YYYY/MM/DD
  const start = moment(range.fromDate).format('YYYY/MM/DD');
  const end = moment(range.toDate).add(1, 'days').format('YYYY/MM/DD');
  
  const span = `after:${start} before:${end}`;
  
  // Scope modifiers
  let scope = '';
  if (options.includeSpam && options.includeTrash) {
      scope = 'in:anywhere'; 
  } else if (options.includeSpam) {
     scope = '(in:inbox OR in:sent OR in:spam)';
  } else if (options.includeTrash) {
     scope = '(in:inbox OR in:sent OR in:trash)';
  } else {
     // Default search (in:anywhere covers 'all mail' except trash/spam usually, but for "all mail" behavior we check docs)
     // Actually "in:anywhere" includes spam and trash.
     // If we want normal behavior (All Mail - Spam - Trash), we just dont specify in:anywhere?
     // Or we specify -in:spam -in:trash?
     // Existing code used 'in:anywhere' which implies Spam+Trash included implicitly if not filtered.
     // Gmail API `includeSpamTrash: true` is needed to even SEE them.
     // If we use `includeSpamTrash: true` in API, then 'in:anywhere' matches everything.
     // If we want to exclude them, we should explicit exclude.
     
     // However, previous code was: const nowhere = 'in:anywhere';
     // This means we were searching spam/trash before? only if includeSpamTrash param was true (it defaults false).
     // So previously 'in:anywhere' with includeSpamTrash=false (default) just searched All Mail.
     
     // New logic:
     // We will always pass includeSpamTrash=true to API if either flag is set.
     // But here we construct the query.
     scope = ''; // relying on API default scope (All Mail) or if we want to be explicit?
     // Let's stick to standard behavior. references to "in:anywhere" are usually robust.
     // But if options.includeSpam is FALSE, we might want to ensure we don't pick it up even if 'in:anywhere' is used?
     // Actually, if we pass includeSpamTrash=false to API, then scope doesn't matter much for those folders.
     
     // Let's simplfy: The user wants to OPT-IN.
     // If opt-in, we use 'in:anywhere' AND passed flag to API.
     // If opt-out (default), we don't use 'in:anywhere' or we explicitly exclude?
     // Let's use 'in:anywhere' only if flags are true, otherwise specific?
     // actually 'in:anywhere' is good base.
     scope = 'in:anywhere'; 
  }
  
  // Wait, if I use `in:anywhere` but API `includeSpamTrash` is false, it won't find spam/trash.
  // So `scope` variable here is less critical than the API flag, EXCEPT if we want to include Spam but NOT Trash.
  // Then API flag must be true, and Query must restrict.
  
  if (options.includeSpam || options.includeTrash) {
      // We must be specific if we want one but not other, or both.
      const parts = ['in:inbox', 'in:sent', 'in:chat', 'in:drafts']; // standard 'all mail' parts approx
      // easier: in:anywhere -in:trash -in:spam
      
      if (options.includeSpam && options.includeTrash) {
          scope = 'in:anywhere';
      } else if (options.includeSpam) {
          scope = 'in:anywhere -in:trash';
      } else if (options.includeTrash) {
          scope = 'in:anywhere -in:spam';
      }
  } else {
      // Normal mode: All Mail (no spam/trash)
      // in:anywhere includes them? Yes.
      // So default should be 'in:anywhere -in:spam -in:trash' if we enabled the API flag?
      // Or just empty scope and let Gmail default? Gmail default is All Mail (minus Spam/Trash)? No, default is Inbox?
      // Usually matching "has:attachment" scans All Mail.
      // Let's keep it simple: 
      // If we are NOT enabling the API flag, then 'in:anywhere' is fine (it won't see spam).
      // If we ARE enabling the API flag (because we added a toggle), we need to be careful.
      // But we only enable API flag if requested.
      // So we can leave scope as `in:anywhere` or empty.
      
      // Previous code: `const nowhere = 'in:anywhere';`
      scope = 'in:anywhere';
  }

  // Base queries
  const queries: string[] = [];

  // NORMAL RECALL
  // 1. Attachments with english keywords
  queries.push(`${scope} ${span} has:attachment (invoice OR receipt OR "tax invoice" OR "payment receipt")`);
  
  // 2. Attachments with hebrew keywords
  queries.push(`${scope} ${span} has:attachment (חשבונית OR קבלה OR "חשבונית מס" OR "חשבונית מס/קבלה" OR זיכוי)`);
  
  // 3. No attachments but keywords
  queries.push(`${scope} ${span} ("invoice" OR "receipt" OR חשבונית OR קבלה) -has:attachment`);
  
  // 4. Any PDF
  queries.push(`${scope} ${span} filename:pdf`);

  // HIGH RECALL ADDS
  if (options.recall === 'high') {
      // 5. Broader filetypes
      queries.push(`${scope} ${span} has:attachment filename:(png OR jpg OR jpeg OR heic)`);
      
      // 6. Confirmation keywords (Hebrew)
      queries.push(`${scope} ${span} (אישור OR עסקה OR חיוב OR תשלום OR הזמנה)`);
      
      // 7. Confirmation keywords (English)
      queries.push(`${scope} ${span} ("order confirmation" OR "payment confirmation" OR "paid" OR "order receipt")`);
      
      // 8. Broad attachment search (catch-all for weird names, rely on classifier)
      // This is very noisy, maybe exclude previously matched? 
      // queries.push(`${scope} ${span} has:attachment`); 
      // Commented out to avoid overwhelming noise for now.
  }

  return queries;
}
