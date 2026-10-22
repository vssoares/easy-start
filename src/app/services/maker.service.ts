import { Injectable, signal } from '@angular/core';
import { invoke, isDesktop } from '../core/desktop';
import { ComStatus, SerialDevice, SerialDriverPackage, UsbDevice } from '../models/maker.model';
import { MessageResult } from '../models/tools.model';

@Injectable({ providedIn: 'root' })
export class MakerService {
  readonly loading = signal(false);
  readonly toast = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly devices = signal<SerialDevice[]>([]);
  readonly ghosts = signal<UsbDevice[]>([]);
  readonly selectedGhosts = signal<ReadonlySet<string>>(new Set());
  readonly packages = signal<SerialDriverPackage[]>([]);
  readonly com = signal<ComStatus | null>(null);

  clearFeedback(): void {
    this.toast.set(null);
    this.error.set(null);
  }

  async loadDevices(): Promise<void> {
    await this.run(async () => this.devices.set(await invoke<SerialDevice[]>('list_serial_devices')));
  }

  async reinstall(device: SerialDevice): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('reinstall_device', { instanceId: device.instanceId });
      this.devices.set(await invoke<SerialDevice[]>('list_serial_devices'));
      this.toast.set(result.message);
    });
  }

  async openOfficialPage(url: string): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('open_driver_page', { url });
      this.toast.set(result.message);
    });
  }

  async loadGhosts(): Promise<void> {
    await this.run(async () => {
      const ghosts = await invoke<UsbDevice[]>('list_ghost_devices');
      this.ghosts.set(ghosts);
      this.selectedGhosts.set(new Set(ghosts.filter((d) => d.suggested).map((d) => d.instanceId)));
    });
  }

  toggleGhost(id: string): void {
    const next = new Set(this.selectedGhosts());
    if (!next.delete(id)) next.add(id);
    this.selectedGhosts.set(next);
  }

  async removeSelectedGhosts(): Promise<void> {
    const instanceIds = [...this.selectedGhosts()];
    await this.run(async () => {
      const result = await invoke<MessageResult>('remove_ghost_devices', { instanceIds });
      this.ghosts.set(await invoke<UsbDevice[]>('list_ghost_devices'));
      this.selectedGhosts.set(new Set());
      this.toast.set(result.message);
    });
  }

  async loadPackages(): Promise<void> {
    await this.run(async () => this.packages.set(await invoke<SerialDriverPackage[]>('list_serial_driver_packages')));
  }

  async removePackage(pkg: SerialDriverPackage): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('remove_serial_driver_package', { publishedName: pkg.publishedName });
      this.packages.set(await invoke<SerialDriverPackage[]>('list_serial_driver_packages'));
      this.toast.set(result.message);
    });
  }

  async loadCom(): Promise<void> {
    await this.run(async () => this.com.set(await invoke<ComStatus>('com_status')));
  }

  async rebuildComDb(): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('rebuild_comdb');
      this.com.set(await invoke<ComStatus>('com_status'));
      this.toast.set(result.message);
    });
  }

  async restoreComDb(): Promise<void> {
    await this.run(async () => {
      const result = await invoke<MessageResult>('restore_comdb');
      this.com.set(await invoke<ComStatus>('com_status'));
      this.toast.set(result.message);
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (!isDesktop()) {
      this.error.set('Disponível apenas no app desktop (Electron).');
      return;
    }

    this.loading.set(true);
    this.clearFeedback();
    try {
      await action();
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }
}
