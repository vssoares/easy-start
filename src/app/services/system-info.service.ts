import { Injectable, signal } from '@angular/core';
import { invoke, isDesktop, listen } from '../core/desktop';
import { DriverProgress, GpuDriverStatus, GpuInfo, SystemInfo } from '../models/system-info.model';

@Injectable({ providedIn: 'root' })
export class SystemInfoService {
  readonly info = signal<SystemInfo | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  /** Estado do driver de cada GPU, indexado pelo nome da placa. */
  readonly driverStatus = signal<Record<string, GpuDriverStatus>>({});
  readonly driverChecking = signal<Record<string, boolean>>({});
  readonly driverProgress = signal<DriverProgress | null>(null);
  /** Nome da GPU cujo driver está sendo baixado/instalado. */
  readonly installingGpu = signal<string | null>(null);
  readonly driverResult = signal<string | null>(null);

  async load(): Promise<void> {
    if (!isDesktop()) {
      this.error.set('Disponível apenas no app desktop (Electron).');
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      this.info.set(info);
      void Promise.all(info.gpus.filter((gpu) => gpu.vendor !== 'other').map((gpu) => this.checkDriver(gpu)));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.loading.set(false);
    }
  }

  async openDriverPage(gpu: GpuInfo): Promise<void> {
    if (!isDesktop() || !gpu.downloadUrl) return;
    try {
      await invoke('open_driver_page', { url: gpu.downloadUrl });
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  async checkDriver(gpu: GpuInfo): Promise<void> {
    if (!isDesktop()) return;

    this.driverChecking.update((current) => ({ ...current, [gpu.name]: true }));
    try {
      const status = await invoke<GpuDriverStatus>('check_gpu_driver', { gpu: this.driverRequest(gpu) });
      this.driverStatus.update((current) => ({ ...current, [gpu.name]: status }));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.driverChecking.update((current) => ({ ...current, [gpu.name]: false }));
    }
  }

  /** Baixa o instalador oficial direto do fabricante, confere a assinatura e o abre. */
  async installDriver(gpu: GpuInfo): Promise<void> {
    if (!isDesktop() || this.installingGpu()) return;

    this.installingGpu.set(gpu.name);
    this.driverProgress.set({ message: 'Iniciando…', percent: 0 });
    this.driverResult.set(null);
    this.error.set(null);

    const stopListening = listen<DriverProgress>('driver-progress', (payload) =>
      this.driverProgress.set(payload),
    );

    try {
      this.driverResult.set(await invoke<string>('install_gpu_driver', { gpu: this.driverRequest(gpu) }));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      stopListening();
      this.installingGpu.set(null);
      this.driverProgress.set(null);
    }
  }

  private driverRequest(gpu: GpuInfo) {
    return { name: gpu.name, driverVersion: gpu.driverVersion, vendor: gpu.vendor };
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
