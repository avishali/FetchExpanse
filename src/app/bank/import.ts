
import * as fs from 'fs';
import * as crypto from 'crypto';
import moment from 'moment';
import { BankTransaction } from '../../types/bank';

export interface CsvMapping {
    dateIndex: number;
    amountIndex: number;
    descIndex: number;
    currencyIndex?: number;
    dateFormat?: string; // e.g. DD/MM/YYYY
}

// Simple CSV Parser handling quotes
function parseCSV(text: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuote = false;
    
    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];
        
        if (inQuote) {
            if (char === '"' && nextChar === '"') {
                currentField += '"';
                i++;
            } else if (char === '"') {
                inQuote = false;
            } else {
                currentField += char;
            }
        } else {
            if (char === '"') {
                inQuote = true;
            } else if (char === ',') {
                currentRow.push(currentField);
                currentField = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && nextChar === '\n') i++;
                currentRow.push(currentField);
                rows.push(currentRow);
                currentRow = [];
                currentField = '';
            } else {
                currentField += char;
            }
        }
    }
    if (currentRow.length > 0 || currentField) {
        currentRow.push(currentField);
        rows.push(currentRow);
    }
    return rows;
}

export function parseBankCsv(filePath: string, accountId: number, mapping: CsvMapping): Omit<BankTransaction, 'id' | 'created_at_ms'>[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const rows = parseCSV(content);
    
    const results: Omit<BankTransaction, 'id' | 'created_at_ms'>[] = [];
    
    // Skip header if heuristics detect it (optional, or rely on UI to say "skip first row")
    // For now, assume UI passes "skipRows" or we just try to parse date and fail silently for header.
    // Let's iterate all and filter valid.
    
    for (const row of rows) {
        if (row.length < 3) continue; // Skip empty/short
        
        const rawDate = row[mapping.dateIndex]?.trim();
        const rawAmount = row[mapping.amountIndex]?.trim();
        const description = row[mapping.descIndex]?.trim();
        const rawCurrency = mapping.currencyIndex !== undefined ? row[mapping.currencyIndex]?.trim() : undefined;
        
        if (!rawDate || !rawAmount) continue;
        
        // Normalize Date
        let date = moment(rawDate, mapping.dateFormat || ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY']);
        if (!date.isValid()) continue; // Skip header
        const txn_date = date.format('YYYY-MM-DD');
        
        // Normalize Amount
        // Remove currency symbols, fix comma/dot based on locale? 
        // Simple heuristic: remove everything except digits, '.', '-', ','
        // If comma is decimal separator? 
        // Let's assume standard format for now or strip non-numeric.
        let amountStr = rawAmount.replace(/[^0-9.,-]/g, '');
        // If comma exists and is last separator, replace with dot? 
        // Or if multiple dots.
        // Simple: parseFloat. If fails, skip.
        const amount = parseFloat(amountStr);
        if (isNaN(amount)) continue;
        
        // Normalize Description
        const cleanDesc = description.replace(/\s+/g, ' ').trim();
        
        // Hash
        const hashPayload = `${txn_date}|${amount}|${cleanDesc}|${rawCurrency || ''}`;
        const row_hash = crypto.createHash('sha256').update(hashPayload).digest('hex');
        
        results.push({
            account_id: accountId,
            txn_date,
            amount,
            description: cleanDesc,
            currency: rawCurrency,
            raw_row_json: JSON.stringify(row),
            row_hash,
            merchant_hint: extractMerchantHint(cleanDesc)
        });
    }
    
    return results;
}

function extractMerchantHint(desc: string): string {
    // Simple extraction: first few words or known prefixes?
    // For now return desc.
    return desc.substring(0, 50);
}

export function previewBankCsv(filePath: string): string[][] {
    // Read first 2KB for preview
    const buffer = Buffer.alloc(2048);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 2048, 0);
    fs.closeSync(fd);
    
    const content = buffer.toString('utf-8');
    // Simple split by newline for robust-ish preview
    // Or use parseCSV on truncated content
    let rows = parseCSV(content);
    if (rows.length > 10) rows = rows.slice(0, 10);
    return rows;
}
