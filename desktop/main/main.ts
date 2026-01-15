import { app, BrowserWindow } from 'electron';
import path from 'path';

// Fix for packaged app trying to write to /data
// We must set DATA_DIR before importing config (via ipc)
if (app) {
    const userDataPath = app.getPath('userData');
    process.env.DATA_DIR = process.env.DATA_DIR || path.join(userDataPath, 'data');
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Check if we are in dev mode
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    // Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // Production build
    // Path from dist/desktop/main/main.js to dist-renderer/index.html
    // dist/desktop/main -> dist/desktop -> dist -> root
    mainWindow.loadFile(path.join(__dirname, '../../../dist-renderer/index.html'));
  }
}

app.whenReady().then(() => {
  // Register safe protocol for local evidence files
  const { protocol, net } = require('electron');
  protocol.handle('evidence', (request: Request) => {
      let url = request.url.replace('evidence://', '');
      // Handle Windows drives if needed, but on Mac/Linux usually fine.
      // net.fetch('file://' + url) is the standard way to proxy safely.
      // Decode URI incase of spaces
      url = decodeURIComponent(url);
      return net.fetch('file://' + url);
  });

  createWindow();
  
  if (mainWindow) {
      // Lazy load IPC to ensure DATA_DIR is set before config is imported
      try {
          const { setupIpc } = require('./ipc');
          setupIpc(mainWindow);
      } catch (e) {
          console.error('SERVER FATAL: Failed to initialize IPC handlers', e);
      }

      // Hard clamp on resize
      mainWindow.on('will-resize', (event, newBounds) => {
          let { width, height } = newBounds;
          let adjusted = false;
          
          if (width < 1100) {
              width = 1100;
              adjusted = true;
          }
          if (height < 720) {
              height = 720;
              adjusted = true;
          }

          if (adjusted) {
              event.preventDefault();
              mainWindow?.setBounds({ x: newBounds.x, y: newBounds.y, width, height });
          }
      });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
