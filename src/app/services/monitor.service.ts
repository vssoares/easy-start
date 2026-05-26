import { computed, Injectable, signal } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { MonitorActionResult, MonitorInfo } from '../models/monitor.model';

@Injectable({ providedIn: 'root' })
export class MonitorService {
  readonly monitors = signal<MonitorInfo[]>([]);
  readonly loading = signal(false);
  readonly toast = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly enabledMonitors = computed(() => this.monitors().filter((monitor) => monitor.isEnabled));
  readonly enabledCount = computed(() => this.enabledMonitors().length);
  readonly primaryMonitor = computed(
    () => this.monitors().find((monitor) => monitor.isPrimary) ?? this.enabledMonitors()[0] ?? null,
  );

  async refresh(): Promise<void> {
    if (!this.begin()) return;

    try {
      this.monitors.set(await invoke<MonitorInfo[]>('list_monitors'));
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  async setEnabled(monitor: MonitorInfo, enabled: boolean): Promise<void> {
    this.clearFeedback();

    if (!enabled && monitor.isEnabled && this.enabledCount() <= 1) {
      this.error.set('Mantenha pelo menos um monitor ativo.');
      return;
    }

    if (!this.begin()) return;

    try {
      const result = await invoke<MonitorActionResult>('set_monitor_enabled', {
        monitorId: monitor.id,
        enabled,
      });
      this.monitors.set(result.monitors);
      this.toast.set(result.message);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  async setPrimary(monitor: MonitorInfo): Promise<void> {
    this.clearFeedback();

    if (!monitor.isEnabled) {
      this.error.set('Ative o monitor antes de defini-lo como principal.');
      return;
    }

    if (monitor.isPrimary) {
      return;
    }

    if (!this.begin()) return;

    try {
      const result = await invoke<MonitorActionResult>('set_primary_monitor', {
        monitorId: monitor.id,
      });
      this.monitors.set(result.monitors);
      this.toast.set(result.message);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  clearFeedback(): void {
    this.error.set(null);
    this.toast.set(null);
  }

  private begin(): boolean {
    if (!isTauri()) {
      this.error.set('Disponível apenas no app desktop (Tauri).');
      return false;
    }

    this.loading.set(true);
    this.error.set(null);
    return true;
  }

  private end(): void {
    this.loading.set(false);
  }

  private formatError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
