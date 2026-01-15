import fs from 'fs';
import path from 'path';
import { ensureDir } from '../util/fs';

export async function captureToPdfOrScreenshot(url: string, outDir: string): Promise<string> {
    ensureDir(outDir);
    const filename = `link_capture_${Date.now()}.url.txt`;
    const dest = path.join(outDir, filename);
    
    fs.writeFileSync(dest, `LINK: ${url}\nCaptured at: ${new Date().toISOString()}`);
    
    return dest;
}
