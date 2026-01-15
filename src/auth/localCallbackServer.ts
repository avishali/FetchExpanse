import http from 'http';
import url from 'url';
import { logger } from '../logging/logger';

export function startLocalCallbackServer(
  redirectUri: string, 
  timeoutMs = 60000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(redirectUri);
    const port = parseInt(parsedUrl.port || '80');
    const pathname = parsedUrl.pathname || '/';

    const server = http.createServer((req, res) => {
      try {
        if (!req.url) return;
        const reqUrl = url.parse(req.url, true);
        
        if (reqUrl.pathname === pathname) {
          const code = reqUrl.query.code as string;
          const error = reqUrl.query.error as string;

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<h1>Authentication Successful</h1><p>You can close this window and return to the CLI.</p>');
            server.close();
            resolve(code);
          } else if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`<h1>Authentication Failed</h1><p>${error}</p>`);
            server.close();
            reject(new Error(`OAuth error: ${error}`));
          }
        }
      } catch (e) {
        logger.error('Callback server error', { error: e });
      }
    });

    server.listen(port, () => {
      logger.info(`Callback server listening on port ${port}`);
    });

    server.on('error', (err) => {
      reject(err);
    });

    // Timeout
    setTimeout(() => {
      server.close();
      reject(new Error('Timeout waiting for authentication callback'));
    }, timeoutMs);
  });
}
