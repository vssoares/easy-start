import { Injectable, signal } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import {
  ActionResult,
  InspectPortResult,
  KillPortResult,
  LocalIpInfo,
} from '../models/quick-access.model';

@Injectable({ providedIn: 'root' })
export class QuickAccessService {
  readonly loading = signal(false);
  readonly toast = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly lastKillResult = signal<KillPortResult | null>(null);
  readonly lastInspectResult = signal<InspectPortResult | null>(null);
  readonly localIps = signal<LocalIpInfo[] | null>(null);

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

  private showSuccess(message: string): void {
    this.toast.set(message);
  }

  async killPort(port: number): Promise<KillPortResult | null> {
    if (!this.begin()) return null;
    if (!this.validPort(port)) return null;

    this.lastKillResult.set(null);
    this.lastInspectResult.set(null);

    try {
      const result = await invoke<KillPortResult>('kill_port', { port });
      this.lastKillResult.set(result);
      return result;
    } catch (err) {
      this.error.set(this.formatError(err));
      return null;
    } finally {
      this.end();
    }
  }

  async inspectPort(port: number): Promise<InspectPortResult | null> {
    if (!this.begin()) return null;
    if (!this.validPort(port)) return null;

    this.lastInspectResult.set(null);
    this.lastKillResult.set(null);

    try {
      const result = await invoke<InspectPortResult>('inspect_port', { port });
      this.lastInspectResult.set(result);
      return result;
    } catch (err) {
      this.error.set(this.formatError(err));
      return null;
    } finally {
      this.end();
    }
  }

  async openFolder(folderId: string): Promise<void> {
    if (!this.begin()) return;

    try {
      const result = await invoke<ActionResult>('open_special_folder', { folder: folderId });
      this.showSuccess(result.message);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  async flushDns(): Promise<void> {
    if (!this.begin()) return;

    try {
      const result = await invoke<ActionResult>('flush_dns');
      this.showSuccess(result.message.split('\n')[0] || result.message);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  async restartExplorer(): Promise<void> {
    if (!this.begin()) return;

    try {
      const result = await invoke<ActionResult>('restart_explorer');
      this.showSuccess(result.message);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  async loadLocalIps(): Promise<void> {
    if (!this.begin()) return;

    try {
      const ips = await invoke<LocalIpInfo[]>('list_local_ips');
      this.localIps.set(ips);
    } catch (err) {
      this.error.set(this.formatError(err));
      this.localIps.set(null);
    } finally {
      this.end();
    }
  }

  async copyText(text: string): Promise<void> {
    if (!this.begin()) return;

    try {
      const result = await invoke<ActionResult>('copy_to_clipboard', { text });
      this.showSuccess(result.message);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  async openSystemTool(toolId: string): Promise<void> {
    if (!this.begin()) return;

    try {
      const result = await invoke<ActionResult>('open_system_tool', { tool: toolId });
      this.showSuccess(result.message);
    } catch (err) {
      this.error.set(this.formatError(err));
    } finally {
      this.end();
    }
  }

  async copyLocalIps(): Promise<void> {
    const ips = this.localIps();
    if (!ips?.length) {
      await this.loadLocalIps();
    }
    const list = this.localIps();
    if (!list?.length) return;

    const text = list.map((ip) => `${ip.name}: ${ip.address}`).join('\n');
    await this.copyText(text);
  }

  clearFeedback(): void {
    this.error.set(null);
    this.toast.set(null);
  }

  private validPort(port: number): boolean {
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      this.error.set('Informe uma porta entre 1 e 65535.');
      this.end();
      return false;
    }
    return true;
  }

  private formatError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
