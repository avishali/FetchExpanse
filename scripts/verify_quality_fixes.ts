// import { formatDate } from '../src/util/dates'; // Hypothetical helper, or just use raw JS

// We want to test logic:
// const [y, m] = month.split('-').map(Number);
// const lastDayDate = new Date(y, m, 0); 
// const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;

function testMonthRange(monthStr: string) {
    const [y, m] = monthStr.split('-').map(Number);
    const lastDayDate = new Date(y, m, 0); 
    const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
    return lastDay;
}

console.log("Testing Month Range Logic:");
const feb2025 = testMonthRange("2025-02");
console.log(`Feb 2025: ${feb2025} (Expected: 2025-02-28) -> ${feb2025 === '2025-02-28' ? 'PASS' : 'FAIL'}`);

const mar2025 = testMonthRange("2025-03");
console.log(`Mar 2025: ${mar2025} (Expected: 2025-03-31) -> ${mar2025 === '2025-03-31' ? 'PASS' : 'FAIL'}`);

const apr2025 = testMonthRange("2025-04");
console.log(`Apr 2025: ${apr2025} (Expected: 2025-04-30) -> ${apr2025 === '2025-04-30' ? 'PASS' : 'FAIL'}`);

const leap2024 = testMonthRange("2024-02");
console.log(`Feb 2024: ${leap2024} (Expected: 2024-02-29) -> ${leap2024 === '2024-02-29' ? 'PASS' : 'FAIL'}`);

// Verify 'evidence:download' presence in IPC by grepping? 
// We can use fs read/includes
import * as fs from 'fs';
import * as path from 'path';

const ipcPath = path.resolve('desktop/main/ipc.ts');
const ipcContent = fs.readFileSync(ipcPath, 'utf8');
const hasDownload = ipcContent.includes("ipcMain.handle('evidence:download'");
console.log(`IPC 'evidence:download' handler exists: ${hasDownload ? 'PASS' : 'FAIL'}`);

const preloadPath = path.resolve('desktop/main/preload.ts');
const preloadContent = fs.readFileSync(preloadPath, 'utf8');
const hasPreload = preloadContent.includes("downloadEvidence:");
console.log(`Preload 'downloadEvidence' exposed: ${hasPreload ? 'PASS' : 'FAIL'}`);

if (feb2025 === '2025-02-28' && mar2025 === '2025-03-31' && leap2024 === '2024-02-29' && hasDownload && hasPreload) {
    console.log("ALL TESTS PASSED");
} else {
    console.error("SOME TESTS FAILED");
    process.exit(1);
}
