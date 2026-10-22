import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

/** Eventos que o processo principal pode enviar ao renderer. */
const EVENTS = ['install-progress', 'update-progress', 'window-maximized'] as const;
type DesktopEvent = (typeof EVENTS)[number];

type Envelope = { ok: true; value: unknown } | { ok: false; error: string };

const api = {
  invoke: async <T>(command: string, args?: unknown): Promise<T> => {
    const result: Envelope = await ipcRenderer.invoke('invoke', command, args);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return result.value as T;
  },

  on: <T>(event: DesktopEvent, callback: (payload: T) => void): (() => void) => {
    if (!EVENTS.includes(event)) {
      throw new Error(`Evento não permitido: ${event}`);
    }
    const listener = (_event: IpcRendererEvent, payload: T) => callback(payload);
    ipcRenderer.on(event, listener);
    return () => ipcRenderer.removeListener(event, listener);
  },
};

contextBridge.exposeInMainWorld('desktop', api);

export type DesktopApi = typeof api;
