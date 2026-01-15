
import { DATA_DIR } from './config';
import { readJson, writeJson, ensureDir } from './util/fs';
import path from 'path';

const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');

export interface AppSettings {
    export: {
        dropboxPath: string; // e.g. "/Hasbula/2025" or "/Tax"
        scheme: 'MONTH_VENDOR' | 'VENDOR_MONTH' | 'TYPE_MONTH';
    };
    gmail: {
        labelOnDecision: boolean;
        labelOnExport: boolean;
    };
}

const DEFAULT_SETTINGS: AppSettings = {
    export: {
        dropboxPath: '/FetchExpanse',
        scheme: 'MONTH_VENDOR'
    },
    gmail: {
        labelOnDecision: false,
        labelOnExport: false
    }
};

export function getSettings(): AppSettings {
    try {
        const stored = readJson(SETTINGS_PATH) as any;
        if (!stored) return DEFAULT_SETTINGS;
        return { 
            export: { ...DEFAULT_SETTINGS.export, ...(stored.export || {}) }, 
            gmail: { ...DEFAULT_SETTINGS.gmail, ...(stored.gmail || {}) } 
        };
    } catch {
        return DEFAULT_SETTINGS;
    }
}

export function saveSettings(settings: Partial<AppSettings>) {
    ensureDir(DATA_DIR);
    const split = getSettings();
    const merged = {
        export: { ...split.export, ...settings.export },
        gmail: { ...split.gmail, ...settings.gmail }
    };
    writeJson(SETTINGS_PATH, merged);
}
