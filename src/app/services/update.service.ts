import { Injectable, signal } from '@angular/core';
import { invoke, isDesktop, listen } from '../core/desktop';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'installing' | 'error' | 'skipped';

interface AppInfo {
  version: string;
  packaged: boolean;
}

interface UpdateCheckResult {
  available: boolean;
  version: string | null;
}

const RELEASES_URL = 'https://github.com/vssoares/easy-start/releases/latest';

@Injectable({ providedIn: 'root' })
export class UpdateService {
  readonly status = signal<UpdateStatus>('idle');
  readonly currentVersion = signal('');
  readonly availableVersion = signal<string | null>(null);
  readonly progress = signal(0);
  readonly errorMessage = signal<string | null>(null);

  readonly hasUpdate = () => this.status() === 'available' && this.availableVersion() !== null;

  async init(): Promise<void> {
    if (!isDesktop()) {
      this.status.set('skipped');
      return;
    }

    try {
      const info = await invoke<AppInfo>('app_info');
      this.currentVersion.set(info.version);

      // Em desenvolvimento (app não empacotado) não há release para consultar.
      if (!info.packaged) {
        this.status.set('skipped');
        return;
      }
    } catch {
      this.currentVersion.set('');
    }

    await this.checkForUpdate();
  }

  async checkForUpdate(): Promise<void> {
    if (!isDesktop()) {
      this.status.set('skipped');
      return;
    }

    this.status.set('checking');
    this.errorMessage.set(null);

    try {
      const result = await invoke<UpdateCheckResult>('update_check');

      if (result.available && result.version) {
        this.availableVersion.set(result.version);
        this.status.set('available');
      } else {
        this.availableVersion.set(null);
        this.status.set('idle');
      }
    } catch (err) {
      this.availableVersion.set(null);
      this.status.set('error');
      this.errorMessage.set(this.describeError(err, 'Falha ao verificar atualizações'));
    }
  }

  async installUpdate(): Promise<void> {
    if (!isDesktop() || !this.hasUpdate()) {
      return;
    }

    this.status.set('installing');
    this.progress.set(0);
    this.errorMessage.set(null);

    const stopListening = listen<{ percent: number }>('update-progress', ({ percent }) =>
      this.progress.set(percent),
    );

    try {
      await invoke('update_download');
      this.progress.set(100);
      // O app fecha, instala e reabre sozinho.
      await invoke('update_install');
    } catch (err) {
      this.status.set('error');
      this.errorMessage.set(this.describeError(err, 'Falha ao instalar atualização'));
    } finally {
      stopListening();
    }
  }

  private describeError(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : String(err);
    const lower = message.toLowerCase();

    if (
      lower.includes('404') ||
      lower.includes('not found') ||
      lower.includes('latest.yml') ||
      lower.includes('cannot find channel')
    ) {
      return (
        'Atualização indisponível: o release não foi encontrado no GitHub. ' +
        'Publique o release (não rascunho) com os assets do instalador e o latest.yml. ' +
        `URL: ${RELEASES_URL}`
      );
    }

    if (lower.includes('sha512') || lower.includes('checksum')) {
      return 'O arquivo baixado não confere com o latest.yml. Republique o release.';
    }

    return message || fallback;
  }
}
