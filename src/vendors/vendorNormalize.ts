import { getDb } from '../db/db';

export function normalizeVendor(fromEmail: string, fromName: string): string {
  // 1. Extract domain
  const domain = fromEmail.split('@')[1] || '';
  
  // 2. Check DB for canonical name (TODO: Implement DB lookups if we had data)
  // For now, return domain or simplified name
  
  // Simple heuristic: Use display name if available and clean, else domain
  if (fromName && !fromName.includes('<')) {
      return sanitize(fromName);
  }
  return sanitize(domain.split('.')[0]); // e.g. 'uber' from uber.com
}

function sanitize(str: string): string {
    return str.replace(/[^a-zA-Z0-9א-ת ]/g, '').trim();
}
