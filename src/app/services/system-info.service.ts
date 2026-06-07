import { Injectable, signal } from '@angular/core';
import { invoke, isTauri } from '@tauri-apps/api/core';
import { GpuInfo, SystemInfo } from '../models/system-info.model';

@Injectable({ providedIn: 'root' })
export class SystemInfoService {
  readonly info = signal<SystemInfo | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    if (!isTauri()) {
      this.error.set('Disponível apenas no app desktop (Tauri).');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      this.info.set(await invoke<SystemInfo>('get_system_info'));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async openDriverPage(gpu: GpuInfo): Promise<void> {
    if (!isTauri() || !gpu.downloadUrl) return;
    try {
      await invoke('open_driver_page', { url: gpu.downloadUrl });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  driverAgeDays(driverDate: string): number {
    if (!driverDate) return 0;
    return Math.floor((Date.now() - new Date(driverDate).getTime()) / 86_400_000);
  }

  isDriverOutdated(driverDate: string): boolean {
    return this.driverAgeDays(driverDate) > 180;
  }

  formatRamGb(kb: number): string {
    return (kb / 1_048_576).toFixed(1);
  }

  formatVram(mb: number): string {
    if (mb === 0) return 'N/D';
    return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`;
  }

  formatSpeed(mhz: number): string {
    return mhz >= 1000 ? `${(mhz / 1000).toFixed(1)} GHz` : `${mhz} MHz`;
  }

  diskUsedPercent(disk: { totalGb: number; freeGb: number }): number {
    if (disk.totalGb === 0) return 0;
    return Math.round(((disk.totalGb - disk.freeGb) / disk.totalGb) * 100);
  }
}
