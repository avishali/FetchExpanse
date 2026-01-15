
import https from 'https';
import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { logger } from '../logging/logger';
import { ensureDir } from '../util/fs';
import { sha256 } from '../util/hash';

export interface DownloadResult {
    status: 'DOWNLOADED' | 'FAILED' | 'NEEDS_LOGIN' | 'UNSUPPORTED';
    resolvedUrl?: string;
    contentType?: string;
    filename?: string;
    localPath?: string;
    sizeBytes?: number;
    sha256?: string;
    httpStatus?: number;
    failureReason?: string;
}

export class LinkDownloader {
    private maxRedirects = 5;
    private maxSizeBytes = 25 * 1024 * 1024; // 25MB
    private timeoutMs = 30000;

    async download(urlStr: string, destDir: string): Promise<DownloadResult> {
        let currentUrl = urlStr;
        let redirects = 0;

        try {
            while (redirects < this.maxRedirects) {
                const result = await this.fetchAttempt(currentUrl, destDir);
                
                if (result.status === 'DOWNLOADED' || result.status === 'NEEDS_LOGIN' || result.status === 'UNSUPPORTED') {
                    return { status: result.status, ...result, resolvedUrl: currentUrl } as DownloadResult;
                }

                if (result.httpStatus && result.httpStatus >= 300 && result.httpStatus < 400 && result.resolvedUrl) {
                    currentUrl = result.resolvedUrl;
                    redirects++;
                    continue;
                }

                return { status: result.status || 'FAILED', ...result, resolvedUrl: currentUrl } as DownloadResult;
            }
            return { status: 'FAILED', failureReason: 'Too many redirects', resolvedUrl: currentUrl };
        } catch (err: any) {
            logger.error(`Link downloader error: ${err.message}`);
            return { status: 'FAILED', failureReason: err.message };
        }
    }

    private fetchAttempt(urlStr: string, destDir: string): Promise<Partial<DownloadResult>> {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(urlStr);
            const protocol = parsedUrl.protocol === 'https:' ? https : http;

            const options = {
                timeout: this.timeoutMs,
                headers: {
                    'User-Agent': config.linkCapture.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': 'application/pdf,application/octet-stream,*/*'
                }
            };

            const req = protocol.get(urlStr, options, (res) => {
                const statusCode = res.statusCode || 0;

                // Handle Redirects
                if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
                    resolve({ httpStatus: statusCode, resolvedUrl: new URL(res.headers.location, urlStr).href });
                    res.resume();
                    return;
                }

                // Handle Failures
                if (statusCode >= 400) {
                    if (statusCode === 401 || statusCode === 403) {
                        resolve({ status: 'NEEDS_LOGIN', httpStatus: statusCode });
                    } else {
                        resolve({ status: 'FAILED', httpStatus: statusCode, failureReason: `HTTP ${statusCode}` });
                    }
                    res.resume();
                    return;
                }

                const contentType = res.headers['content-type'] || 'application/octet-stream';
                const isPdf = contentType.includes('pdf');
                const isImage = contentType.includes('image/');
                const isOctet = contentType.includes('octet-stream');

                // If HTML, check for login keywords
                if (contentType.includes('text/html')) {
                    let body = '';
                    res.on('data', chunk => {
                        if (body.length < 5000) body += chunk.toString();
                    });
                    res.on('end', () => {
                        const loginKeywords = ['login', 'sign in', 'התחבר', 'חשבון שלי', 'email address', 'password'];
                        if (loginKeywords.some(k => body.toLowerCase().includes(k))) {
                            resolve({ status: 'NEEDS_LOGIN', contentType });
                        } else {
                            resolve({ status: 'UNSUPPORTED', contentType, failureReason: 'HTML page but no login wall detected' });
                        }
                    });
                    return;
                }

                if (!isPdf && !isImage && !isOctet) {
                    resolve({ status: 'UNSUPPORTED', contentType, failureReason: `Unsupported content type: ${contentType}` });
                    res.resume();
                    return;
                }

                // Download File
                ensureDir(destDir);
                const contentDisposition = res.headers['content-disposition'] || '';
                let filename = 'invoice.pdf';
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                } else {
                    const pathParts = parsedUrl.pathname.split('/');
                    const lastPart = pathParts[pathParts.length - 1];
                    if (lastPart && lastPart.includes('.')) {
                        filename = lastPart;
                    }
                }

                const filePath = path.join(destDir, `${Date.now()}_${filename}`);
                const fileStream = fs.createWriteStream(filePath);
                let downloadedBytes = 0;

                res.on('data', (chunk) => {
                    downloadedBytes += chunk.length;
                    if (downloadedBytes > this.maxSizeBytes) {
                        req.destroy();
                        fileStream.close();
                        fs.unlinkSync(filePath);
                        resolve({ status: 'FAILED', failureReason: 'File too large' });
                    } else {
                        fileStream.write(chunk);
                    }
                });

                res.on('end', () => {
                    fileStream.end();
                });

                fileStream.on('finish', () => {
                    if (downloadedBytes <= this.maxSizeBytes) { // Only if not aborted
                        try {
                            const fileBuf = fs.readFileSync(filePath);
                            resolve({
                                status: 'DOWNLOADED',
                                contentType,
                                filename,
                                localPath: filePath,
                                sizeBytes: downloadedBytes,
                                sha256: sha256(fileBuf)
                            });
                        } catch (e: any) {
                             resolve({ status: 'FAILED', failureReason: 'File read error: ' + e.message });
                        }
                    }
                });
            });

            req.on('error', (err) => resolve({ status: 'FAILED', failureReason: err.message }));
            req.on('timeout', () => {
                req.destroy();
                resolve({ status: 'FAILED', failureReason: 'Timeout' });
            });
        });
    }
}
