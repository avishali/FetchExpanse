import { getDb } from '../db/db';
import { writeJson, ensureDir } from '../util/fs';
import path from 'path';
import { config } from '../config';

import { DateRange } from '../types/dateRange';

export function generateRecurringReport(range: DateRange, patterns: any[]) {
    const reportPath = path.join(config.dataDir, 'reports', `recurring_${range.from}_to_${range.to}.json`);
    ensureDir(path.dirname(reportPath));
    writeJson(reportPath, patterns);
    return reportPath;
}
