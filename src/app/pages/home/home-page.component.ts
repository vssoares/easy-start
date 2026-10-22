import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SECTIONS } from '../../data/sections.data';
import { SensorsService } from '../../services/sensors.service';
import { UpdateService } from '../../services/update.service';

@Component({
  selector: 'page-home',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 shrink-0">
        <h1 class="text-2xl font-bold text-white">Início</h1>
        <p class="mt-0.5 text-sm text-zinc-500">Resumo do PC agora e atalhos para tudo que o Easy Start faz</p>
      </header>

      <div class="min-h-0 flex-1 space-y-5 overflow-y-auto pr-2 scrollbar-thin">
        @if (updates.hasUpdate()) {
          <p class="rounded-lg border border-app-accent/30 bg-app-accent/10 px-4 py-3 text-sm text-app-accent-soft">
            {{ updates.status() === 'ready' ? 'Atualização pronta: será instalada ao fechar o app.' : 'Baixando atualização…' }}
          </p>
        }

        <section class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (tile of tiles(); track tile.label) {
            <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">{{ tile.label }}</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ tile.value }}</p>
              <p class="mt-0.5 truncate text-xs text-zinc-500" [title]="tile.detail">{{ tile.detail }}</p>
              <div class="mt-2 h-1.5 w-full rounded-full bg-white/10">
                <div class="h-full rounded-full bg-app-accent transition-all" [style.width]="tile.percent + '%'"></div>
              </div>
            </article>
          }
        </section>

        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Atalhos</h2>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            @for (section of sections; track section.route) {
              <a
                [routerLink]="section.route"
                class="rounded-xl border border-white/5 bg-app-surface px-5 py-4 transition hover:border-white/15"
              >
                <h3 class="text-sm font-semibold text-white">{{ section.label }}</h3>
                <p class="mt-0.5 text-sm text-zinc-500">{{ section.description }}</p>
              </a>
            }
          </div>
        </section>
      </div>
    </section>
  `,
})
export class HomePageComponent implements OnInit, OnDestroy {
  protected readonly sensors = inject(SensorsService);
  protected readonly updates = inject(UpdateService);
  protected readonly sections = SECTIONS;

  ngOnInit(): void {
    this.sensors.start();
  }

  ngOnDestroy(): void {
    this.sensors.stop();
  }

  protected tiles(): { label: string; value: string; detail: string; percent: number }[] {
    const s = this.sensors.snapshot();
    const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value)}%`);
    const clamp = (value: number | null) => Math.min(100, Math.max(0, value ?? 0));

    return [
      { label: 'CPU', value: pct(s?.cpu.load ?? null), detail: s?.cpu.name ?? 'Carregando…', percent: clamp(s?.cpu.load ?? null) },
      { label: 'GPU', value: pct(s?.gpu.load ?? null), detail: s?.gpu.name ?? 'GPU principal', percent: clamp(s?.gpu.load ?? null) },
      {
        label: 'Memória de vídeo',
        value: pct(s?.gpu.vramPercent ?? null),
        detail: s?.gpu.vramUsedMb != null ? `${Math.round(s.gpu.vramUsedMb)} MB em uso` : 'Indisponível',
        percent: clamp(s?.gpu.vramPercent ?? null),
      },
      {
        label: 'Memória RAM',
        value: pct(s?.ram.percent ?? null),
        detail: s ? `${(s.ram.usedMb / 1024).toFixed(1)} / ${(s.ram.totalMb / 1024).toFixed(1)} GB` : 'Carregando…',
        percent: clamp(s?.ram.percent ?? null),
      },
    ];
  }
}
