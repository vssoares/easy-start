/** Ponte com o processo principal do Electron (exposta pelo preload como `window.desktop`). */
type DesktopEvent = 'install-progress' | 'update-progress' | 'window-maximized';

interface DesktopApi {
  invoke<T>(command: string, args?: unknown): Promise<T>;
  on<T>(event: DesktopEvent, callback: (payload: T) => void): () => void;
}

declare global {
  interface Window {
    desktop?: DesktopApi;
  }
}

export function isDesktop(): boolean {
  return typeof window !== 'undefined' && !!window.desktop;
}

function bridge(): DesktopApi {
  if (!window.desktop) {
    throw new Error('Disponível apenas no app desktop (Electron).');
  }
  return window.desktop;
}

export function invoke<T>(command: string, args?: unknown): Promise<T> {
  return bridge().invoke<T>(command, args);
}

/** Escuta um evento do processo principal; retorna a função que cancela a inscrição. */
export function listen<T>(event: DesktopEvent, callback: (payload: T) => void): () => void {
  return bridge().on<T>(event, callback);
}
