import { getSettings } from '../configStore';
import path from 'path';

export function getDropboxPath(date: Date, vendor: string, filename: string): string {
    const settings = getSettings();
    const basePath = settings.export.dropboxPath || '/FetchExpanse';
    const scheme = settings.export.scheme || 'MONTH_VENDOR';

    const year = date.getFullYear();
    const monthNum = date.getMonth() + 1;
    const monthName = date.toLocaleString('en-US', { month: 'long' });
    const monthStr = `${monthNum.toString().padStart(2, '0')} - ${monthName}`;
    const yearMonth = `${year}/${monthStr}`; // "2024/01 - January"
    
    // Clean filename
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const safeVendor = vendor.replace(/[^a-zA-Z0-9.\-_ ]/g, '').trim() || 'Unknown';

    // Type is not passed yet, assuming "Expense" or "Receipt". 
    // The scheme TYPE_MONTH implies we need type. For now, we will treat it as just Vendor/Month if type is missing or add type arg later. 
    // The requirement says: month/vendor/type.
    // Let's assume Type="Receipt" for now or update signature. 
    // I'll stick to 2-level schemes or add "Receipt" constant for now as item.kind is EVIDENCE/ATTACHMENT.
    const docType = 'Receipt'; 

    let subPath = '';
    switch (scheme) {
        case 'MONTH_VENDOR':
            subPath = `${yearMonth}/${safeVendor}/${docType}`;
            break;
        case 'VENDOR_MONTH':
            subPath = `${safeVendor}/${yearMonth}/${docType}`;
            break;
        case 'TYPE_MONTH':
            subPath = `${docType}/${yearMonth}/${safeVendor}`;
            break;
        default:
            subPath = `${yearMonth}/${safeVendor}`;
    }

    // Join ensures correct slashes, but for Dropbox API we want forward slashes. 
    // path.join might use backslashes on windows. So we use template strings with / which is safe for Dropbox API.
    
    // Normalize slashes just in case
    const fullPath = `${basePath}/${subPath}/${safeFilename}`.replace(/\/+/g, '/');
    return fullPath;
}
