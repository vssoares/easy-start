import { computed, Injectable, signal } from '@angular/core';
import { invoke, isDesktop } from '../core/desktop';
import { BackgroundApp, CleanMemoryResult, CloseAppsResult, MemoryStatus, Tweak } from '../models/optimize.model';

@Injectable({ providedIn: 'root' })
export class OptimizeService {
  readonly memory = signal<MemoryStatus | null>(null);
  readonly apps = signal<BackgroundApp[]>([]);
  readonly selectedApps = signal<ReadonlySet<string>>(new Set());
  readonly tweaks = signal<Tweak[]>([]);
  /** Mensagem por ajuste, mostrada abaixo da descrição (Aplicado, Desligado, falhas). */
  readonly tweakStatus = signal<Readonly<Record<string, string>>>({});

  readonly optimizing = signal(false);
  readonly result = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly selectedAppList = computed(() => this.apps().filter((app) => this.selectedApps().has(app.processName)));

  async load(): Promise<void> {
    if (!this.available()) return;
    this.error.set(null);
    await Promise.all([this.refreshMemory(), this.refreshApps(), this.refreshTweaks()]);
  }

  async refreshMemory(): Promise<void> {
    await this.guard(async () => this.memory.set(await invoke<MemoryStatus>('memory_status')));
  }

  async refreshApps(): Promise<void> {
    await this.guard(async () => {
      const apps = await invoke<BackgroundApp[]>('list_background_apps');
      this.apps.set(apps);
      this.selectedApps.set(new Set(apps.filter((app) => app.suggested).map((app) => app.processName)));
    });
  }

  async refreshTweaks(): Promise<void> {
    await this.guard(async () => this.tweaks.set(await invoke<Tweak[]>('list_tweaks')));
  }

  toggleApp(name: string): void {
    const next = new Set(this.selectedApps());
    if (!next.delete(name)) next.add(name);
    this.selectedApps.set(next);
  }

  /** RESET OTIMIZA: fecha os programas marcados e depois limpa a memória (para contar também o que eles liberaram). */
  async optimize(): Promise<void> {
    if (!this.available()) return;

    const selected = this.selectedAppList();
    this.optimizing.set(true);
    this.result.set(null);
    this.error.set(null);

    try {
      const closed = selected.length
        ? await invoke<CloseAppsResult>('close_apps', { names: selected.map((app) => app.processName) })
        : { closed: [], notClosed: [] };
      const memory = await invoke<CleanMemoryResult>('clean_memory');

      const titleOf = (name: string) => selected.find((app) => app.processName === name)?.title ?? name;
      const parts = [`Memória liberada: ${Math.round(memory.freedBytes / 1048576).toLocaleString('pt-BR')} MB`];
      parts.push(memory.purged ? 'memória em espera limpa' : `memória em espera não limpa (${memory.error})`);
      if (closed.closed.length) parts.push(`fechados: ${closed.closed.map(titleOf).join(', ')}`);
      if (closed.notClosed.length) {
        parts.push(`não fecharam (podem ter algo não salvo ou pedir confirmação): ${closed.notClosed.map(titleOf).join(', ')}`);
      }
      this.result.set(`${parts.join(' · ')}.`);

      await Promise.all([this.refreshApps(), this.refreshMemory()]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.optimizing.set(false);
    }
  }

  async setTweak(tweak: Tweak, enabled: boolean): Promise<void> {
    if (!this.available()) return;

    try {
      await invoke('set_tweak', { id: tweak.id, enabled });
      const tweaks = await invoke<Tweak[]>('list_tweaks');
      this.tweaks.set(tweaks);

      const applied = tweaks.find((t) => t.id === tweak.id)?.isOn === enabled;
      this.setStatus(
        tweak.id,
        applied
          ? `${enabled ? 'Aplicado.' : 'Desligado.'}${tweak.needsRestart ? ' Reinicie o PC para valer.' : ''}`
          : 'O Windows não aceitou a mudança (pode exigir administrador).',
      );
    } catch (err) {
      // Volta ao estado real: o interruptor só reflete o que está no sistema.
      this.tweaks.update((list) => [...list]);
      this.setStatus(tweak.id, `Falhou: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async restoreTweaks(): Promise<void> {
    if (!this.available()) return;

    try {
      await invoke('restore_tweaks');
      this.tweaks.set(await invoke<Tweak[]>('list_tweaks'));
      this.tweakStatus.set({});
      this.result.set('Ajustes restaurados para os valores originais.');
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  private setStatus(id: string, message: string): void {
    this.tweakStatus.update((status) => ({ ...status, [id]: message }));
  }

  private available(): boolean {
    if (isDesktop()) return true;
    this.error.set('Disponível apenas no app desktop (Electron).');
    return false;
  }

  private async guard(action: () => Promise<void>): Promise<void> {
    try {
      await action();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }
}
