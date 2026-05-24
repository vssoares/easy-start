import { Injectable, signal } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { NodeVersionsResponse, NvmStatus } from '../models/node.model';

@Injectable({ providedIn: 'root' })
export class NodeManagerService {
  readonly loading = signal(false);
  readonly actionVersion = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly data = signal<NodeVersionsResponse | null>(null);

  private refreshTask: Promise<void> | null = null;

  async refresh(): Promise<void> {
    if (!isTauri()) {
      this.error.set('Gerenciador Node só funciona no app desktop (Tauri).');
      return;
    }

    if (this.refreshTask) {
      return this.refreshTask;
    }

    this.refreshTask = this.runRefresh();
    try {
      await this.refreshTask;
    } finally {
      this.refreshTask = null;
    }
  }

  async ensureNvm(): Promise<NvmStatus | null> {
    if (!isTauri()) {
      this.error.set('Gerenciador Node só funciona no app desktop (Tauri).');
      return null;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await invoke<NodeVersionsResponse>('ensure_nvm');
      this.data.set(response);
      return response.status;
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async install(version: string): Promise<void> {
    await this.runAction(version, 'install_node_version');
  }

  async uninstall(version: string): Promise<void> {
    await this.runAction(version, 'uninstall_node_version');
  }

  async use(version: string): Promise<void> {
    await this.runAction(version, 'use_node_version');
  }

  private async runRefresh(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const response = await invoke<NodeVersionsResponse>('list_node_versions');
      this.data.set(response);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  private async runAction(
    version: string,
    command: 'install_node_version' | 'uninstall_node_version' | 'use_node_version',
  ): Promise<void> {
    if (!isTauri()) {
      this.error.set('Gerenciador Node só funciona no app desktop (Tauri).');
      return;
    }

    this.loading.set(true);
    this.actionVersion.set(version);
    this.error.set(null);

    try {
      const response = await invoke<NodeVersionsResponse>(command, { version });
      this.data.set(response);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
      await this.refresh();
    } finally {
      this.loading.set(false);
      this.actionVersion.set(null);
    }
  }
}
