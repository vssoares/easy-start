import { Injectable, signal } from '@angular/core';
import { invoke, isDesktop } from '../core/desktop';
import { MessageResult, StartupEntry, StartupList, StartupRemoved } from '../models/tools.model';

/** Programas de inicialização do Windows (página Inicialização). */
@Injectable({ providedIn: 'root' })
export class ToolsService {
  readonly loading = signal(false);
  readonly toast = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly startup = signal<StartupEntry[]>([]);
  readonly removed = signal<StartupRemoved[]>([]);

  async loadStartup(): Promise<void> {
    await this.run(() => this.reload());
  }

  async setStartupEnabled(entry: StartupEntry, enabled: boolean): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('set_startup_enabled', { ref: this.ref(entry), enabled });
      await this.reload();
      this.toast.set(result.message);
    });
  }

  async removeStartup(entry: StartupEntry): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('remove_startup', { ref: this.ref(entry) });
      await this.reload();
      this.toast.set(result.message);
    });
  }

  async restoreStartup(item: StartupRemoved): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('restore_startup', { removedAt: item.removedAt });
      await this.reload();
      this.toast.set(result.message);
    });
  }

  private async reload(): Promise<void> {
    const list = await invoke<StartupList>('list_startup');
    this.startup.set(list.entries);
    this.removed.set(list.removed);
  }

  private ref(entry: StartupEntry) {
    return { kind: entry.kind, machine: entry.machine, name: entry.name, filePath: entry.filePath ?? undefined };
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (!isDesktop()) {
      this.error.set('Disponível apenas no app desktop (Electron).');
      return;
    }

    this.loading.set(true);
    this.toast.set(null);
    this.error.set(null);
    try {
      await action();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
