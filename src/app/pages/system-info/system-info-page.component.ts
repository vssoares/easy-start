import { Component, inject, OnInit } from '@angular/core';
import { DiskInfo, GpuInfo } from '../../models/system-info.model';
import { SystemInfoService } from '../../services/system-info.service';

@Component({
  selector: 'page-system-info',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 flex shrink-0 items-start justify-between gap-4">
        <section>
          <h1 class="text-2xl font-bold text-white">Meu PC</h1>
          <p class="mt-0.5 text-sm text-zinc-500">Hardware, drivers e armazenamento</p>
        </section>
        <button
          type="button"
          class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          [disabled]="sys.loading()"
          (click)="sys.load()"
        >
          {{ sys.loading() ? 'Carregando...' : 'Atualizar' }}
        </button>
      </header>

      @if (sys.error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ sys.error() }}
        </p>
      }

      @if (sys.loading() && !sys.info()) {
        <section class="flex flex-col gap-4">
          <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
            @for (item of skeletons; track item) {
              <span class="skeleton-shimmer block h-20 rounded-xl"></span>
            }
          </section>
          <span class="skeleton-shimmer block h-40 rounded-xl"></span>
          <span class="skeleton-shimmer block h-32 rounded-xl"></span>
        </section>
      } @else if (sys.info(); as info) {
        <section class="min-h-0 flex-1 overflow-y-auto pr-2 scrollbar-thin">

          <!-- Summary cards -->
          <section class="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Processador</p>
              <p class="mt-1 truncate text-sm font-semibold text-white" [title]="info.cpuName">
                {{ info.cpuName }}
              </p>
              <p class="mt-0.5 text-xs text-zinc-500">
                {{ info.cpuCores }} núcleos · {{ info.cpuLogical }} threads · {{ sys.formatSpeed(info.cpuMhz) }}
              </p>
            </article>

            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Memória RAM</p>
              <p class="mt-1 text-sm font-semibold text-white">
                {{ sys.formatRamGb(info.ramTotalKb) }} GB total
              </p>
              <p class="mt-0.5 text-xs text-zinc-500">
                {{ sys.formatRamGb(info.ramFreeKb) }} GB livre
              </p>
              <div class="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div
                  class="h-full rounded-full transition-all"
                  [class]="ramBarColor(info.ramTotalKb, info.ramFreeKb)"
                  [style.width]="ramUsedPercent(info.ramTotalKb, info.ramFreeKb) + '%'"
                ></div>
              </div>
            </article>

            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Sistema Operacional</p>
              <p class="mt-1 truncate text-sm font-semibold text-white" [title]="info.osCaption">
                {{ info.osCaption }}
              </p>
              <p class="mt-0.5 text-xs text-zinc-500">
                Build {{ info.osBuild }}
              </p>
            </article>

            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Placa-Mãe</p>
              <p class="mt-1 truncate text-sm font-semibold text-white"
                [title]="info.moboManufacturer + ' ' + info.moboProduct">
                {{ info.moboProduct || 'Desconhecido' }}
              </p>
              <p class="mt-0.5 truncate text-xs text-zinc-500">
                {{ info.moboManufacturer }}{{ info.moboVersion ? ' · ' + info.moboVersion : '' }}
              </p>
            </article>
          </section>

          <!-- GPU section -->
          @if (info.gpus.length > 0) {
            <section class="mb-5">
              <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Placa de Vídeo
              </h2>
              <section class="flex flex-col gap-3">
                @for (gpu of info.gpus; track gpu.name) {
                  <article
                    class="rounded-xl border bg-app-surface p-5 transition"
                    [class.border-amber-500/40]="sys.isDriverOutdated(gpu.driverDate)"
                    [class.border-white/10]="!sys.isDriverOutdated(gpu.driverDate)"
                  >
                    <header class="flex flex-wrap items-start justify-between gap-3">
                      <section class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <h3 class="truncate text-base font-semibold text-white">{{ gpu.name }}</h3>
                          <span
                            class="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                            [class]="vendorBadgeClass(gpu)"
                          >
                            {{ gpu.vendor === 'other' ? 'GPU' : gpu.vendor.toUpperCase() }}
                          </span>
                        </div>
                        @if (gpu.vramMb > 0) {
                          <p class="mt-0.5 text-xs text-zinc-500">{{ sys.formatVram(gpu.vramMb) }} VRAM</p>
                        }
                      </section>

                      @if (sys.isDriverOutdated(gpu.driverDate)) {
                        <span class="shrink-0 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-300">
                          Possivelmente desatualizado
                        </span>
                      } @else if (gpu.driverDate) {
                        <span class="shrink-0 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-300">
                          Driver recente
                        </span>
                      }
                    </header>

                    <section class="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                      <div class="rounded-lg bg-white/3 px-3 py-2">
                        <p class="text-xs text-zinc-500">Versão do driver</p>
                        <p class="mt-0.5 font-medium text-zinc-200">{{ gpu.driverVersion || 'N/D' }}</p>
                      </div>
                      <div class="rounded-lg bg-white/3 px-3 py-2">
                        <p class="text-xs text-zinc-500">Data do driver</p>
                        <p class="mt-0.5 font-medium text-zinc-200">
                          {{ gpu.driverDate ? formatDate(gpu.driverDate) : 'N/D' }}
                        </p>
                      </div>
                      @if (gpu.driverDate) {
                        <div class="rounded-lg bg-white/3 px-3 py-2">
                          <p class="text-xs text-zinc-500">Idade do driver</p>
                          <p class="mt-0.5 font-medium" [class]="driverAgeColor(gpu.driverDate)">
                            {{ sys.driverAgeDays(gpu.driverDate) }} dias
                          </p>
                        </div>
                      }
                    </section>

                    @if (gpu.downloadUrl) {
                      <footer class="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40"
                          [class]="downloadBtnClass(gpu)"
                          [disabled]="sys.loading()"
                          (click)="sys.openDriverPage(gpu)"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                          Baixar driver {{ gpu.vendor !== 'other' ? gpu.vendor.toUpperCase() : '' }}
                        </button>
                        @if (sys.isDriverOutdated(gpu.driverDate)) {
                          <p class="text-xs text-zinc-500">
                            Driver com mais de {{ sys.driverAgeDays(gpu.driverDate) }} dias — verifique se há atualizações
                          </p>
                        }
                      </footer>
                    }
                  </article>
                }
              </section>
            </section>
          }

          <!-- Disk section -->
          @if (info.disks.length > 0) {
            <section class="mb-4">
              <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Armazenamento
              </h2>
              <section class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                @for (disk of info.disks; track disk.deviceId) {
                  <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
                    <div class="flex items-center justify-between">
                      <p class="text-sm font-semibold text-white">{{ disk.deviceId }}</p>
                      <p class="text-xs text-zinc-500">
                        {{ disk.freeGb.toFixed(1) }} GB livres de {{ disk.totalGb.toFixed(1) }} GB
                      </p>
                    </div>
                    <div class="mt-2 h-2 w-full rounded-full bg-white/10">
                      <div
                        class="h-full rounded-full transition-all"
                        [class]="diskBarColor(disk)"
                        [style.width]="sys.diskUsedPercent(disk) + '%'"
                      ></div>
                    </div>
                    <p class="mt-1 text-right text-xs" [class]="diskPercentColor(disk)">
                      {{ sys.diskUsedPercent(disk) }}% usado
                    </p>
                  </article>
                }
              </section>
            </section>
          }

        </section>
      }
    </section>
  `,
})
export class SystemInfoPageComponent implements OnInit {
  protected readonly sys = inject(SystemInfoService);
  protected readonly skeletons = [1, 2, 3];

  ngOnInit(): void {
    if (!this.sys.info() && !this.sys.loading()) {
      void this.sys.load();
    }
  }

  protected ramUsedPercent(totalKb: number, freeKb: number): number {
    if (totalKb === 0) return 0;
    return Math.round(((totalKb - freeKb) / totalKb) * 100);
  }

  protected ramBarColor(totalKb: number, freeKb: number): string {
    const pct = this.ramUsedPercent(totalKb, freeKb);
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-app-accent';
  }

  protected vendorBadgeClass(gpu: GpuInfo): string {
    switch (gpu.vendor) {
      case 'nvidia':
        return 'bg-emerald-500/15 text-emerald-300';
      case 'amd':
        return 'bg-app-accent/15 text-app-accent-soft';
      case 'intel':
        return 'bg-sky-500/15 text-sky-300';
      default:
        return 'bg-zinc-700/40 text-zinc-400';
    }
  }

  protected downloadBtnClass(gpu: GpuInfo): string {
    if (this.sys.isDriverOutdated(gpu.driverDate)) {
      return 'bg-amber-500 hover:bg-amber-400';
    }
    return 'bg-app-accent hover:bg-app-accent-hover-soft';
  }

  protected driverAgeColor(driverDate: string): string {
    const days = this.sys.driverAgeDays(driverDate);
    if (days > 365) return 'text-red-400';
    if (days > 180) return 'text-amber-400';
    return 'text-zinc-200';
  }

  protected diskBarColor(disk: DiskInfo): string {
    const pct = this.sys.diskUsedPercent(disk);
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 70) return 'bg-amber-500';
    return 'bg-app-accent';
  }

  protected diskPercentColor(disk: DiskInfo): string {
    const pct = this.sys.diskUsedPercent(disk);
    if (pct >= 90) return 'text-red-400';
    if (pct >= 70) return 'text-amber-400';
    return 'text-zinc-500';
  }

  protected formatDate(iso: string): string {
    try {
      return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(iso),
      );
    } catch {
      return iso;
    }
  }
}
