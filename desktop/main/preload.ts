import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  doctor: () => ipcRenderer.invoke('app:doctor'),
  openExternal: (url: string) => ipcRenderer.invoke('open:external', url),
  
  getSettings: () => ipcRenderer.invoke('app:getSettings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('app:saveSettings', settings),
  
  authGmailStart: () => ipcRenderer.invoke('auth:gmail'),
  authDropboxStart: () => ipcRenderer.invoke('auth:dropbox'),
  
  scan: (range: any, options: any) => ipcRenderer.invoke('scan:start', range, options),
  
  onScanProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('scan:progress', (_event, data) => callback(data));
  },
  
  logError: (error: any) => ipcRenderer.send('log:error', error),

  getReviewList: (range: any, status?: string) => ipcRenderer.invoke('review:list', range, status),
  getReviewDetail: (id: number) => ipcRenderer.invoke('review:detail', id),
  setDecision: (id: number, status: string, vendor?: string, category?: string) => ipcRenderer.invoke('review:decision', id, status, vendor, category),
  getNextReviewItem: (currentId: number, range: any, filter: string) => ipcRenderer.invoke('review:next', currentId, range, filter),
  getSuggestedDecision: (id: number) => ipcRenderer.invoke('review:suggest', id),
  applyBatchDecision: (ids: number[], status: string, vendor?: string, category?: string) => ipcRenderer.invoke('review:batch', ids, status, vendor, category),
  markRead: (ids: number[]) => ipcRenderer.invoke('review:markRead', ids),
  markUnread: (ids: number[]) => ipcRenderer.invoke('review:markUnread', ids),

  export: (range: any, options: { mock?: boolean }) => ipcRenderer.invoke('export:start', range, options),
  previewExport: (range: any) => ipcRenderer.invoke('export:preview', range),
  onExportProgress: (callback: (data: any) => void) => {
    ipcRenderer.on('export:progress', (_event, data) => callback(data));
  },

  getRecurring: (range: any) => ipcRenderer.invoke('recurring:get', range),

  openEvidence: (path: string) => ipcRenderer.invoke('evidence:open', path),
  downloadEvidence: (id: number) => ipcRenderer.invoke('evidence:download', id),
  revealEvidence: (path: string) => ipcRenderer.invoke('evidence:reveal', path),
  getEmailBody: (id: number) => ipcRenderer.invoke('emailBody:get', id),
  
  getDashboardStats: () => ipcRenderer.invoke('stats:get'),
  
  // Phase 3 Coverage
  getCoverageSummary: (range: any) => ipcRenderer.invoke('coverage:summary', range),
  getCoverageByMonth: (range: any) => ipcRenderer.invoke('coverage:month', range),
  getIncompleteItems: (range: any, kind: string) => ipcRenderer.invoke('coverage:incomplete', range, kind),
  
  // Phase 4 Bank
  bank: {
      listAccounts: () => ipcRenderer.invoke('bank:listAccounts'),
      createAccount: (name: string, currency?: string) => ipcRenderer.invoke('bank:createAccount', name, currency),
      previewCsv: (filePath: string) => ipcRenderer.invoke('bank:previewCsv', filePath),
      importCsv: (accountId: number, filePath: string, mapping: any) => ipcRenderer.invoke('bank:importCsv', accountId, filePath, mapping),
      reconcile: (accountId: number, range: any) => ipcRenderer.invoke('bank:reconcile', accountId, range),
      getReconciliation: (accountId: number, range: any) => ipcRenderer.invoke('bank:getReconciliation', accountId, range),
      exportReconciliation: (accountId: number, range: any) => ipcRenderer.invoke('bank:export', accountId, range)
  },

  // Clean up listeners if needed
  removeListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
});
