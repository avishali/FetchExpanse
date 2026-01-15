
import http from 'http';
import fs from 'fs';
import path from 'path';
import { LinkDownloader } from '../src/evidence/linkDownloader';
import { ensureDir } from '../src/util/fs';

// Mock Server Setup
const PORT = 45678;
const BASE_URL = `http://localhost:${PORT}`;

const server = http.createServer((req, res) => {
    const url = req.url || '';
    
    if (url === '/invoice.pdf') {
        res.writeHead(200, { 
            'Content-Type': 'application/pdf', 
            'Content-Disposition': 'attachment; filename="test_invoice.pdf"' 
        });
        res.end('%PDF-1.4 Mock Invoice Content');
        return;
    }

    if (url === '/redirect-me') {
        res.writeHead(302, { 'Location': `${BASE_URL}/invoice.pdf` });
        res.end();
        return;
    }

    if (url === '/redirect-loop') {
        res.writeHead(302, { 'Location': `${BASE_URL}/redirect-loop` });
        res.end();
        return;
    }

    if (url === '/login') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Please Login</h1><form>Login form</form></body></html>');
        return;
    }
    
    if (url === '/page-with-invoice') {
        // HTML page with no login, just generic
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><p>Some random page</p></body></html>');
        return;
    }

    if (url === '/large-file') {
        res.writeHead(200, { 'Content-Type': 'application/pdf' });
        // Send 30MB of A's
        const chunk = Buffer.alloc(1024 * 1024, 'A'); 
        for (let i = 0; i < 30; i++) {
            res.write(chunk);
        }
        res.end();
        return;
    }

    res.writeHead(404);
    res.end('Not Found');
});

async function runTests() {
    console.log('Starting Mock Server...');
    await new Promise<void>(resolve => server.listen(PORT, resolve));
    
    const downloader = new LinkDownloader();
    const testDir = path.resolve(__dirname, '../data/test_evidence');
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
    ensureDir(testDir);

    console.log('Running Tests...');
    const results: any[] = [];

    // Test 1: Direct PDF
    results.push(await downloader.download(`${BASE_URL}/invoice.pdf`, testDir));

    // Test 2: Redirect
    results.push(await downloader.download(`${BASE_URL}/redirect-me`, testDir));

    // Test 3: Login Page
    results.push(await downloader.download(`${BASE_URL}/login`, testDir));

    // Test 4: 404
    results.push(await downloader.download(`${BASE_URL}/not-found`, testDir));

    // Test 5: Infinite Redirect
    results.push(await downloader.download(`${BASE_URL}/redirect-loop`, testDir));
    
    // Test 6: Large File
    results.push(await downloader.download(`${BASE_URL}/large-file`, testDir));

    console.log('Stopping Server...');
    server.close();

    // Verify Results
    const checkDisplay = results.map((r, i) => {
        const tests = ['Direct', 'Redirect', 'Login', '404', 'Loop', 'Large'];
        return { test: tests[i], status: r.status, reason: r.failureReason, resolved: r.resolvedUrl };
    });

    console.table(checkDisplay);

    if (results[0].status !== 'DOWNLOADED') throw new Error('Direct PDF failed');
    if (results[1].status !== 'DOWNLOADED') throw new Error('Redirect PDF failed');
    if (results[2].status !== 'NEEDS_LOGIN') throw new Error('Login detection failed');
    if (results[3].status !== 'FAILED') throw new Error('404 handling failed');
    if (results[4].status !== 'FAILED') throw new Error('Redirect loop handling failed');
    if (results[5].status !== 'FAILED') throw new Error('Large file handling failed');

    // Check file existence
    if (!fs.existsSync(results[0].localPath)) throw new Error('File not written for Test 1');

    console.log('✅ ALL TESTS PASSED');
}

runTests().catch(err => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
});
