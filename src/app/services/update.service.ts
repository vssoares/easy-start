import { Injectable, signal } from '@angular/core';
import { isTauri } from '@tauri-apps/api/core';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'installing' | 'error' | 'skipped';

const UPDATE_ENDPOINT =
  'https://github.com/vssoares/easy-start/releases/latest/download/latest.json';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly status = signal<UpdateStatus>('idle');
  readonly currentVersion = signal('');
  readonly availableVersion = signal<string | null>(null);
  readonly progress = signal(0);
  readonly errorMessage = signal<string | null>(null);

  readonly hasUpdate = () => this.status() === 'available' && this.availableVersion() !== null;

  async init(): Promise<void> {
    if (!this.shouldCheckUpdates()) {
      this.status.set('skipped');
      return;
    }

    try {
      const { getVersion } = await import('@tauri-apps/api/app');
      this.currentVersion.set(await getVersion());
    } catch {
      this.currentVersion.set('');
    }

    await this.checkForUpdate();
  }

  async checkForUpdate(): Promise<void> {
    if (!this.shouldCheckUpdates()) {
      this.status.set('skipped');
      return;
    }

    this.status.set('checking');
    this.errorMessage.set(null);

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();

      if (update) {
        this.availableVersion.set(update.version);
        this.status.set('available');
      } else {
        this.availableVersion.set(null);
        this.status.set('idle');
      }
    } catch (err) {
      this.availableVersion.set(null);
      this.status.set('error');
      this.errorMessage.set(this.describeCheckError(err));
    }
  }

  async installUpdate(): Promise<void> {
    if (!isTauri() || !this.hasUpdate()) {
      return;
    }

    this.status.set('installing');
    this.progress.set(0);
    this.errorMessage.set(null);

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const { relaunch } = await import('@tauri-apps/plugin-process');
      const update = await check();

      if (!update) {
        this.status.set('idle');
        this.availableVersion.set(null);
        return;
      }

      let downloaded = 0;
      let contentLength = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0;
            this.progress.set(0);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              this.progress.set(Math.round((downloaded / contentLength) * 100));
            }
            break;
          case 'Finished':
            this.progress.set(100);
            break;
        }
      });

      await relaunch();
    } catch (err) {
      this.status.set('error');
      this.errorMessage.set(err instanceof Error ? err.message : 'Falha ao instalar atualização');
    }
  }

  private shouldCheckUpdates(): boolean {
    if (!isTauri()) {
      return false;
    }

    const host = globalThis.location?.hostname ?? '';
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      return false;
    }

    return true;
  }

  private describeCheckError(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();

    if (
      lower.includes('status code') ||
      lower.includes('404') ||
      lower.includes('not found') ||
      lower.includes('successful status')
    ) {
      return (
        'Atualização indisponível: o manifesto não foi encontrado no GitHub Releases. ' +
        'Publique o release (não rascunho) com o asset latest.json. ' +
        `URL: ${UPDATE_ENDPOINT}`
      );
    }

    if (lower.includes('signature') || lower.includes('assinatura')) {
      return 'Assinatura inválida. O CI precisa do secret TAURI_SIGNING_PRIVATE_KEY igual à pubkey do app.';
    }

    return message || 'Falha ao verificar atualizações';
  }
}
