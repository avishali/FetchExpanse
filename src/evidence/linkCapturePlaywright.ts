
import { chromium, Browser, Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import { logger } from '../logging/logger';
import { CapturedLink } from './evidenceTypes';
import { sha256 } from '../util/hash';
import { ensureDir } from '../util/fs';

// Cached browser instance to reuse across a batch?
// Or launch per capture? Launching per capture is safer but slower.
// Let's implement single instance management if needed, but for now simple:
// We can use a singleton lazily or launch/close inside step.
// Given "Phase 2.5", let's keep it safe: Launch and Close per batch or item.
// Better: Launch once per `evidenceStep` call?
// For now, `captureLinkToEvidence` will assume it manages its own page/context, 
// potentially reusing a browser passed in, or launching one.
// The PROMPT says: "Always close browser, even on errors." implies per-link or per-session closure.
// Let's implement `captureLink` that takes a browser instance, or launches one if not provided?
// Actually, `evidenceStep` processes multiple items. Launching browser 100 times is bad.
// We'll export a class or functions to manage browser lifecycle.

export class LinkCapturer {
    private browser: Browser | null = null;

    async init() {
        if (!this.browser && config.linkCapture.enabled) {
            logger.info('Initializing Playwright browser...');
            try {
                this.browser = await chromium.launch({
                    headless: config.linkCapture.headless,
                    args: ['--no-sandbox', '--disable-setuid-sandbox'] // Safer for docker/electron envs sometimes
                });
            } catch (e) {
                logger.error('Failed to launch browser', e);
            }
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async capture(url: string, outputDir: string, filenameBase: string): Promise<CapturedLink | null> {
        if (!this.browser) return null;

        // Blocklist check
        const domain = new URL(url).hostname;
        if (config.linkCapture.blocklist.some(d => domain.includes(d))) {
            logger.info(`Skipping blocked domain: ${domain}`);
            return null;
        }

        const context = await this.browser.newContext({
            userAgent: config.linkCapture.userAgent,
            viewport: { width: 1280, height: 1024 }
        });

        const page = await context.newPage();
        let result: CapturedLink | null = null;

        try {
            logger.debug(`Navigating to ${url}`);
            await page.goto(url, {
                timeout: config.linkCapture.navTimeoutMs,
                waitUntil: 'domcontentloaded' // 'networkidle' can be flaky
            });
            
            // Wait a bit for JS renders
            await page.waitForTimeout(1500);

            ensureDir(outputDir);
            
            // Try PDF first
            // Note: page.pdf only works in headless mode.
            if (config.linkCapture.headless) {
                try {
                    const pdfPath = path.join(outputDir, `${filenameBase}.pdf`);
                    await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
                    const fileBuf = fs.readFileSync(pdfPath);
                    result = {
                        kind: 'LINK_PDF',
                        localPath: pdfPath,
                        filename: `${filenameBase}.pdf`,
                        mimeType: 'application/pdf',
                        sha256: sha256(fileBuf),
                        sourceUrl: url
                    };
                } catch (e) {
                    logger.debug('PDF capture failed, falling back to screenshot', e);
                }
            }

            // Fallback to Screenshot
            if (!result) {
                const imgPath = path.join(outputDir, `${filenameBase}.png`);
                await page.screenshot({ path: imgPath, fullPage: true });
                const fileBuf = fs.readFileSync(imgPath);
                result = {
                    kind: 'LINK_SCREENSHOT',
                    localPath: imgPath,
                    filename: `${filenameBase}.png`,
                    mimeType: 'image/png',
                    sha256: sha256(fileBuf),
                    sourceUrl: url
                };
            }

        } catch (e: any) {
            logger.warn(`Link capture failed for ${url}: ${e.message}`);
            // Fallback: HTML snapshot? PROMPT says: "If navigation fails or page errors: Save HTML content snapshot if any"
            // If checking e.message, maybe partial load happened.
            try {
                const content = await page.content();
                if (content && content.length > 500) {
                     const htmlPath = path.join(outputDir, `${filenameBase}.html`);
                     fs.writeFileSync(htmlPath, content);
                     const fileBuf = Buffer.from(content);
                     result = {
                        kind: 'LINK_HTML_SNAPSHOT',
                        localPath: htmlPath,
                        filename: `${filenameBase}.html`,
                        mimeType: 'text/html',
                        sha256: sha256(fileBuf),
                        sourceUrl: url
                    };
                    logger.info('Saved HTML snapshot fallback');
                }
            } catch (snapErr) {
                 // ignore
            }
        } finally {
            await context.close();
        }

        return result;
    }
}
