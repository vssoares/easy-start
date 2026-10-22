import { Injectable, OnDestroy, signal } from '@angular/core';
import { invoke, isDesktop, listen } from '../core/desktop';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'error'
  | 'skipped';

/** Estado enviado pelo processo principal, que cuida de todo o ciclo de atualização. */
type UpdateState =
  | { status: 'idle' | 'checking' | 'ready' | 'skipped' }
  | { status: 'downloading'; version: string; percent: number }
  | { status: 'error'; message: string };

interface AppInfo {
  version: string;
  packaged: boolean;
}

const RELEASES_URL = 'https://github.com/vssoares/easy-start/releases/latest';

/**
 * A atualização é automática: o app checa, baixa e instala sozinho ao abrir.
 * Este serviço só reflete o andamento na interface.
 */
@Injectable({ providedIn: 'root' })
export class UpdateService implements OnDestroy {
  readonly status = signal<UpdateStatus>('idle');
  readonly currentVersion = signal('');
  readonly availableVersion = signal<string | null>(null);
  readonly progress = signal(0);
  readonly errorMessage = signal<string | null>(null);

  /** Há uma atualização sendo baixada ou pronta para instalar. */
  readonly hasUpdate = () => this.status() === 'downloading' || this.status() === 'ready';

  private stopListening: (() => void) | null = null;

  async init(): Promise<void> {
    if (!isDesktop()) {
      this.status.set('skipped');
      return;
    }

    this.stopListening ??= listen<UpdateState>('update-state', (state) => this.apply(state));

    try {
      this.currentVersion.set((await invoke<AppInfo>('app_info')).version);
      this.apply(await invoke<UpdateState>('update_state'));
    } catch {
      this.currentVersion.set('');
    }
  }

  /** Tenta de novo depois de um erro. */
  async checkForUpdate(): Promise<void> {
    if (!isDesktop()) return;
    try {
      await invoke('update_check');
    } catch (err) {
      this.apply({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  ngOnDestroy(): void {
    this.stopListening?.();
  }

  private apply(state: UpdateState): void {
    this.status.set(state.status);
    this.errorMessage.set(null);

    switch (state.status) {
      case 'downloading':
        this.availableVersion.set(state.version);
        this.progress.set(state.percent);
        break;
      case 'error':
        this.errorMessage.set(this.describeError(state.message));
        break;
      case 'idle':
      case 'skipped':
        this.availableVersion.set(null);
        break;
    }
  }

  private describeError(message: string): string {
    const lower = message.toLowerCase();

    if (lower.includes('404') || lower.includes('not found') || lower.includes('latest.yml')) {
      return (
        'Atualização indisponível: o release não foi encontrado no GitHub. ' +
        'Publique o release (não rascunho) com os assets do instalador e o latest.yml. ' +
        `URL: ${RELEASES_URL}`
      );
    }

    if (lower.includes('sha512') || lower.includes('checksum')) {
      return 'O arquivo baixado não confere com o latest.yml. Republique o release.';
    }

    return message || 'Falha ao atualizar';
  }
}
