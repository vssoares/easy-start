import { Injectable, computed, inject, signal } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { PROGRAMS } from '../data/programs.data';
import {
  InstallBatchResult,
  InstallProgressEvent,
  InstallRequest,
} from '../models/install.model';
import { Program } from '../models/program.model';

@Injectable({ providedIn: 'root' })
export class InstallService {
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly installing = signal(false);
  readonly progress = signal<InstallProgressEvent | null>(null);
  readonly lastResults = signal<InstallBatchResult | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly selectedPrograms = computed(() =>
    PROGRAMS.filter((program) => this.selectedIds().has(program.id)),
  );
  readonly installableSelected = computed(() =>
    this.selectedPrograms().filter((program) => !!program.wingetId),
  );
  readonly unsupportedSelected = computed(() =>
    this.selectedPrograms().filter((program) => !program.wingetId),
  );

  private unlisten: UnlistenFn | null = null;

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string): void {
    if (this.installing()) {
      return;
    }

    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  clearSelection(): void {
    if (this.installing()) {
      return;
    }
    this.selectedIds.set(new Set());
  }

  selectAll(programs: Program[]): void {
    if (this.installing()) {
      return;
    }
    this.selectedIds.set(new Set(programs.map((program) => program.id)));
  }

  async installSelected(): Promise<void> {
    if (this.installing()) {
      return;
    }

    if (!isTauri()) {
      this.error.set('A instalação só funciona no app desktop (Tauri).');
      return;
    }

    const installable = this.installableSelected();
    if (installable.length === 0) {
      this.error.set('Nenhum app selecionado possui suporte winget.');
      return;
    }

    this.error.set(null);
    this.lastResults.set(null);
    this.installing.set(true);

    if (this.unlisten) {
      await this.unlisten();
      this.unlisten = null;
    }

    this.unlisten = await listen<InstallProgressEvent>('install-progress', (event) => {
      this.progress.set(event.payload);
    });

    const requests: InstallRequest[] = installable.map((program) => ({
      appId: program.id,
      name: program.name,
      wingetId: program.wingetId!,
    }));

    try {
      const wingetOk = await invoke<boolean>('check_winget');
      if (!wingetOk) {
        throw new Error('winget não encontrado. Instale o App Installer da Microsoft Store.');
      }

      const result = await invoke<InstallBatchResult>('install_apps', { apps: requests });
      this.lastResults.set(result);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.installing.set(false);
      if (this.unlisten) {
        await this.unlisten();
        this.unlisten = null;
      }
    }
  }
}
