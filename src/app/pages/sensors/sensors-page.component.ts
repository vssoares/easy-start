import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Limiter } from '../../models/sensors.model';
import { SensorsService } from '../../services/sensors.service';

const VERDICT_STYLE: Record<Limiter, string> = {
  gpu: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  cpu: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  vram: 'border-red-500/30 bg-red-500/10 text-red-300',
  ram: 'border-red-500/30 bg-red-500/10 text-red-300',
  thermal: 'border-red-500/30 bg-red-500/10 text-red-300',
  capped: 'border-white/10 bg-app-surface text-zinc-300',
};

@Component({
  selector: 'page-sensors',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 shrink-0">
        <h1 class="text-2xl font-bold text-white">Sensores</h1>
        <p class="mt-0.5 text-sm text-zinc-500">Uso, temperatura e gargalo em tempo real (atualiza a cada segundo)</p>
      </header>

      @if (sensors.error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ sensors.error() }}
        </p>
      }

      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 scrollbar-thin">
        @if (sensors.snapshot(); as s) {
          @if (sensors.verdict(); as v) {
            <article class="rounded-xl border px-5 py-4" [class]="verdictStyle(v.limiter)">
              <p class="text-xs uppercase tracking-wide opacity-70">Detector de gargalo</p>
              <h2 class="mt-1 text-lg font-semibold">{{ v.title }}</h2>
              <p class="mt-1 text-sm opacity-90">{{ v.advice }}</p>
            </article>
          }

          <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">CPU</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ pct(s.cpu.load) }}</p>
              <p class="mt-0.5 truncate text-xs text-zinc-500" [title]="s.cpu.name">{{ s.cpu.name }}</p>
              <div class="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div class="h-full rounded-full transition-all" [class]="bar(s.cpu.load)" [style.width]="width(s.cpu.load)"></div>
              </div>
              <p class="mt-2 text-xs text-zinc-400">
                Núcleo mais ocupado: {{ pct(s.cpu.busiestCore) }}
                @if (s.cpu.busiestCoreIndex !== null) {
                  (#{{ s.cpu.busiestCoreIndex }})
                }
              </p>
              <p class="text-xs text-zinc-400">
                Temperatura: {{ s.cpu.temperature !== null ? s.cpu.temperature + ' °C' : 'indisponível' }}
              </p>
            </article>

            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">GPU</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ pct(s.gpu.load) }}</p>
              <p class="mt-0.5 truncate text-xs text-zinc-500" [title]="s.gpu.name ?? ''">
                {{ s.gpu.name ?? 'GPU principal' }}
              </p>
              <div class="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div class="h-full rounded-full transition-all" [class]="bar(s.gpu.load)" [style.width]="width(s.gpu.load)"></div>
              </div>
              <p class="mt-2 text-xs text-zinc-400">
                Temperatura: {{ s.gpu.temperature !== null ? s.gpu.temperature + ' °C' : 'indisponível' }}
              </p>
              <p class="text-xs text-zinc-400">Fonte: {{ s.sources.gpu }}</p>
            </article>

            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Memória de vídeo</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ pct(s.gpu.vramPercent) }}</p>
              <p class="mt-0.5 text-xs text-zinc-500">
                {{ mb(s.gpu.vramUsedMb) }} / {{ mb(s.gpu.vramTotalMb) }}
              </p>
              <div class="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div class="h-full rounded-full transition-all" [class]="bar(s.gpu.vramPercent)" [style.width]="width(s.gpu.vramPercent)"></div>
              </div>
            </article>

            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Memória RAM</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ pct(s.ram.percent) }}</p>
              <p class="mt-0.5 text-xs text-zinc-500">{{ mb(s.ram.usedMb) }} / {{ mb(s.ram.totalMb) }}</p>
              <div class="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div class="h-full rounded-full transition-all" [class]="bar(s.ram.percent)" [style.width]="width(s.ram.percent)"></div>
              </div>
            </article>
          </section>

          <section class="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <article class="rounded-xl border border-white/5 bg-app-surface p-5">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-400">CPU · último minuto</h2>
              <svg class="mt-3 h-24 w-full" viewBox="0 0 60 100" preserveAspectRatio="none" role="img" aria-label="Uso da CPU">
                <polyline fill="none" stroke="#e8192c" stroke-width="1.5" vector-effect="non-scaling-stroke" [attr.points]="line(sensors.cpuHistory())" />
              </svg>
            </article>
            <article class="rounded-xl border border-white/5 bg-app-surface p-5">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-400">GPU · último minuto</h2>
              <svg class="mt-3 h-24 w-full" viewBox="0 0 60 100" preserveAspectRatio="none" role="img" aria-label="Uso da GPU">
                <polyline fill="none" stroke="#ff6674" stroke-width="1.5" vector-effect="non-scaling-stroke" [attr.points]="line(sensors.gpuHistory())" />
              </svg>
            </article>
          </section>

          <section>
            <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Placa de vídeo</h2>
            <article class="rounded-xl border border-white/5 bg-app-surface p-5">
              <dl class="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
                @for (row of liveRows(); track row.label) {
                  <div>
                    <dt class="text-xs text-zinc-500">{{ row.label }}</dt>
                    <dd class="mt-0.5 text-sm text-zinc-100">{{ row.value }}</dd>
                  </div>
                }
              </dl>

              @if (sensors.details(); as d) {
                @if (d.available) {
                  <dl class="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-white/5 pt-4 sm:grid-cols-3 lg:grid-cols-4">
                    @for (row of detailRows(); track row.label) {
                      <div>
                        <dt class="text-xs text-zinc-500">{{ row.label }}</dt>
                        <dd class="mt-0.5 break-words text-sm text-zinc-100">{{ row.value }}</dd>
                      </div>
                    }
                  </dl>
                } @else {
                  <p class="mt-4 border-t border-white/5 pt-4 text-sm text-zinc-500">{{ d.message }}</p>
                }
              }
            </article>
          </section>

          <p class="text-xs text-zinc-600">
            Temperatura da CPU: {{ s.sources.cpuTemperature }}. Muitas placas-mãe não expõem esse sensor ao Windows; nesse caso o valor
            aparece como indisponível.
          </p>
        } @else if (!sensors.error()) {
          <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            @for (item of skeletons; track item) {
              <span class="skeleton-shimmer block h-36 rounded-xl"></span>
            }
          </section>
        }
      </div>
    </section>
  `,
})
export class SensorsPageComponent implements OnInit, OnDestroy {
  protected readonly sensors = inject(SensorsService);
  protected readonly skeletons = [1, 2, 3, 4];

  ngOnInit(): void {
    this.sensors.start();
  }

  ngOnDestroy(): void {
    this.sensors.stop();
  }

  verdictStyle(limiter: Limiter): string {
    return VERDICT_STYLE[limiter];
  }

  pct(value: number | null): string {
    return value === null ? '—' : `${Math.round(value)}%`;
  }

  width(value: number | null): string {
    return `${Math.min(100, Math.max(0, value ?? 0))}%`;
  }

  bar(value: number | null): string {
    if ((value ?? 0) >= 90) return 'bg-red-500';
    if ((value ?? 0) >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  mb(value: number | null): string {
    if (value === null) return '—';
    return value >= 1024 ? `${(value / 1024).toFixed(1)} GB` : `${Math.round(value)} MB`;
  }

  /** Pontos de um gráfico 60x100: x = tempo, y invertido (100% fica no topo). */
  line(history: number[]): string {
    const offset = 60 - history.length;
    return history.map((value, index) => `${index + offset},${100 - Math.min(100, Math.max(0, value))}`).join(' ');
  }

  liveRows(): { label: string; value: string }[] {
    const gpu = this.sensors.snapshot()?.gpu;
    if (!gpu) return [];
    const unit = (value: number | null, suffix: string) => (value === null ? '—' : `${Math.round(value * 10) / 10} ${suffix}`);
    return [
      { label: 'Clock do núcleo', value: unit(gpu.coreClockMhz, 'MHz') },
      { label: 'Clock da memória', value: unit(gpu.memoryClockMhz, 'MHz') },
      {
        label: 'Consumo',
        value: gpu.powerWatts === null ? '—' : `${unit(gpu.powerWatts, 'W')}${gpu.powerLimitWatts ? ' / ' + Math.round(gpu.powerLimitWatts) + ' W' : ''}`,
      },
      { label: 'Ventoinha', value: unit(gpu.fanPercent, '%') },
      { label: 'Limite térmico', value: gpu.thermalThrottle ? 'Ativo' : 'Não' },
    ];
  }

  detailRows(): { label: string; value: string }[] {
    const d = this.sensors.details();
    if (!d || !d.available) return [];
    const gen = (current: number | null, max: number | null) => (current === null ? '—' : `Gen ${current} (máx. ${max ?? '—'})`);
    const width = (current: number | null, max: number | null) => (current === null ? '—' : `x${current} (máx. x${max ?? '—'})`);
    return [
      { label: 'Driver', value: d.driverVersion },
      { label: 'VBIOS', value: d.vbios },
      { label: 'Barramento PCI', value: d.pciBus },
      { label: 'Capacidade de computação', value: d.computeCapability },
      { label: 'PCIe (agora)', value: gen(d.pcieGenCurrent, d.pcieGenMax) },
      { label: 'Largura PCIe', value: width(d.pcieWidthCurrent, d.pcieWidthMax) },
      { label: 'Clock máx. núcleo', value: d.maxCoreClockMhz === null ? '—' : `${d.maxCoreClockMhz} MHz` },
      { label: 'Clock máx. memória', value: d.maxMemoryClockMhz === null ? '—' : `${d.maxMemoryClockMhz} MHz` },
      { label: 'Limite de energia', value: d.powerLimitWatts === null ? '—' : `${Math.round(d.powerLimitWatts)} W (máx. ${Math.round(d.powerMaxWatts ?? 0)} W)` },
      { label: 'VRAM', value: this.mb(d.vramTotalMb) },
    ];
  }
}
