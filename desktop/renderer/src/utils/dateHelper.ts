
/**
 * Calculates the exact date range for a given month using local time.
 * This ensures we correctly handle 28/29/30/31 days without timezone offsets.
 * 
 * @param year e.g. 2025
 * @param monthIndex 0-based (0 = Jan, 1 = Feb, ...)
 * @returns { from, toInclusive, days }
 */
export function getMonthRange(year: number, monthIndex: number) {
    // 1. First day: Year, Month, 1
    const from = new Date(year, monthIndex, 1);
    
    // 2. Last day: Year, Month + 1, 0 (Day 0 of next month is last day of current)
    const toInclusive = new Date(year, monthIndex + 1, 0);

    // Helpers to format YYYY-MM-DD manually to avoid "toISOString()" UTC shifts
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    const fmt = (d: Date) => {
        const y = d.getFullYear();
        const m = d.getMonth() + 1; // getMonth is 0-based
        const day = d.getDate();
        return `${y}-${pad(m)}-${pad(day)}`;
    };

    return {
        from,
        toInclusive,
        fromStr: fmt(from),
        toInclusiveStr: fmt(toInclusive),
        days: toInclusive.getDate()
    };
}
