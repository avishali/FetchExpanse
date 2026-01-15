import { getDb } from '../db/db';
import { RecurringPattern } from '../db/models';

import { DateRange } from '../types/dateRange';
import moment from 'moment';

export function detectRecurring(range: DateRange): RecurringPattern[] {
  const db = getDb();
  
  // Normalized vendor, distinct month
  // Filter by date range
  
  const fromIso = range.from; // YYYY-MM-DD
  const toIso = range.to;     // YYYY-MM-DD
  
  const sql = `
    SELECT from_domain as vendor, strftime('%Y-%m', date_iso) as month_val
    FROM messages 
    WHERE label = 'EXPENSE' 
      AND date_iso >= ? 
      AND date_iso <= ?
  `;
  
  // Note: date_iso is likely ISO8601 full string. String comparison works for YYYY-MM-DD prefix if properly formatted.
  // Actually we should append time to end date to encompass it, or assume date_iso comparison works.
  // Let's rely on internal_date_ms if possible, or append 'T23:59:59' to toIso.
  const toIsoEnd = toIso + 'T23:59:59.999Z';
  
  const rows = db.prepare(sql).all(fromIso, toIsoEnd) as {vendor: string, month_val: string}[];
  
  const map = new Map<string, Set<string>>();
  
  for (const r of rows) {
      if (!map.has(r.vendor)) map.set(r.vendor, new Set());
      map.get(r.vendor)?.add(r.month_val);
  }

  const results: RecurringPattern[] = [];
  
  // Calculate threshold
  const startM = moment(range.fromDate);
  const endM = moment(range.toDate);
  const monthsInRange = endM.diff(startM, 'months', true); 
  // ceil(monthsInRange) approx.
  // heuristic: max(6, ceil(months * 0.5))
  // For 12 months -> max(6, 6) = 6. 
  // For 1 month -> max(6, 0.5) = 6? That's too high.
  // Wait, if range is small, recurring doesn't make sense or threshold should be lower?
  // User spec: "mark recurring if appears in >= max(6, ceil(monthsInRange * 0.5)) distinct months"
  // If I select "Last Month", monthsInRange ~ 1. Threshold 6. So nothing recurring. Use case: recurring is for year/long term.
  // If I select "Last 3 months", threshold 6. 
  // Maybe user meant min(..., ...)? No, recurring implies regularity. 
  // If I only distinct 3 months, I can't be sure it's recurring monthly unless I see enough.
  // I will stick to the spec rule.
  
  const distinctMonths = Math.ceil(monthsInRange); 
  const threshold = Math.max(6, Math.ceil(distinctMonths * 0.5));

  for (const [vendor, months] of map.entries()) {
      if (months.size >= threshold) { 
          results.push({
              id: 0, // Generated
              vendor,
              year: 0, // Deprecated or we can set to start year
              months_json: JSON.stringify(Array.from(months).sort()),
              count_months: months.size,
              created_at: new Date().toISOString()
          });
      }
  }
  
  return results;
}
