import { IpcApi } from '../../shared/ipcTypes';

declare global {
  interface Window {
    api: IpcApi;
  }
}

export const api = window.api;
