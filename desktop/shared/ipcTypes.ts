import { DateRange, DateRangeArgs } from '../../src/types/dateRange';


export interface AppSettings {
    export: {
        dropboxPath: string;
        scheme: 'MONTH_VENDOR' | 'VENDOR_MONTH' | 'TYPE_MONTH';
    };
    gmail: {
        labelOnDecision: boolean;
        labelOnExport: boolean;
    };
}

export interface IpcApi {
  getAppInfo: () => Promise<{ version: string; dataDir: string; dbPath: string; auth: { gmail: boolean; dropbox: boolean } }>;
  doctor: () => Promise<{ ok: boolean; checks: any[] }>;
  
  getSettings: () => Promise<AppSettings>;
  saveSettings: (settings: Partial<AppSettings>) => Promise<{ ok: boolean }>;

  openExternal: (url: string) => Promise<void>;
  
  authGmailStart: () => Promise<{ ok: boolean }>;
  authDropboxStart: () => Promise<{ ok: boolean }>;
  
  scan: (range: DateRangeArgs, options: { mock?: boolean, recall?: 'normal' | 'high' | 'high_strict', includeSpam?: boolean, includeTrash?: boolean }) => Promise<{ ok: boolean, stats?: any, error?: string }>;
  onScanProgress: (callback: (data: any) => void) => void;

  // Review
  getReviewList: (range: DateRangeArgs, status?: string) => Promise<any[]>;
  getReviewDetail: (id: number) => Promise<any>;
  setDecision: (id: number, status: string, vendor?: string, category?: string) => Promise<{ ok: boolean }>;
  markRead: (ids: number[]) => Promise<{ ok: boolean }>;
  markUnread: (ids: number[]) => Promise<{ ok: boolean }>;
  getNextReviewItem: (currentId: number, range: DateRangeArgs, filter: string) => Promise<number | null>;
  getSuggestedDecision: (id: number) => Promise<{ status?: string, vendor?: string, category?: string } | null>;
  applyBatchDecision: (ids: number[], status: string, vendor?: string, category?: string) => Promise<{ ok: boolean }>;

  // Export
  export: (range: DateRangeArgs, options: { mock?: boolean }) => Promise<any>;
  previewExport: (range: DateRangeArgs) => Promise<string[]>;
  exportAccountantPack: (range: DateRangeArgs) => Promise<{ path: string; filename: string }>;
  onExportProgress: (callback: (data: any) => void) => void;

  // Recurring
  getRecurring: (range: DateRangeArgs) => Promise<{ patterns: any[], reportPath: string }>;

  // Evidence
  downloadEvidence: (id: number) => Promise<{ local_path: string }>;
  openEvidence: (path: string) => Promise<void>;
  revealEvidence: (path: string) => Promise<void>;
  getEmailBody: (id: number) => Promise<{ html?: string; text?: string; source: string; diag?: any }>;
  
  logError: (error: any) => void;
  getDashboardStats: () => Promise<{ coverage: any[], topReasons: any[] }>; // Legacy
  
  // Phase 3 Coverage
  getCoverageSummary: (range: DateRangeArgs) => Promise<any>;
  getCoverageByMonth: (range: DateRangeArgs) => Promise<any[]>;
  getIncompleteItems: (range: DateRangeArgs, kind: string) => Promise<number[]>;

  // Phase 4 Bank
  bank: {
      listAccounts: () => Promise<any[]>;
      createAccount: (name: string, currency?: string) => Promise<{ id: number }>;
      previewCsv: (filePath: string) => Promise<string[][]>;
      importCsv: (accountId: number, filePath: string, mapping: any) => Promise<any>; // Returns BankImportResult
      reconcile: (accountId: number, range: DateRangeArgs) => Promise<any>; // Returns summary
      getReconciliation: (accountId: number, range: DateRangeArgs) => Promise<{ matched: any[], unmatched: any[], orphans: any[] }>;
      exportReconciliation: (accountId: number, range: DateRangeArgs) => Promise<{ path: string }>;
  }
}
