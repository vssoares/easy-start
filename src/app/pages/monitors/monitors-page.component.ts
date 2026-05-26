import { Component, computed, inject, OnInit } from '@angular/core';
import { MonitorInfo } from '../../models/monitor.model';
import { MonitorService } from '../../services/monitor.service';

@Component({
  selector: 'page-monitors',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 flex shrink-0 items-start justify-between gap-4">
        <section>
          <h1 class="text-2xl font-bold text-white">Monitores</h1>
          <p class="mt-0.5 text-sm text-zinc-500">Controle de telas ativas e monitor principal</p>
        </section>
        <button
          type="button"
          class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          [disabled]="monitors.loading()"
          (click)="monitors.refresh()"
        >
          Atualizar
        </button>
      </header>

      @if (monitors.error()) {
        <p
          class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {{ monitors.error() }}
        </p>
      } @else if (monitors.toast()) {
        <p
          class="mb-4 shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300"
        >
          {{ monitors.toast() }}
        </p>
      }

      <section class="mb-6 grid shrink-0 grid-cols-1 gap-3 md:grid-cols-3">
        <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Ativos</p>
          <p class="mt-1 text-xl font-semibold text-white">
            {{ monitors.enabledCount() }} / {{ monitors.monitors().length }}
          </p>
        </article>
        <article class="rounded-xl border border-white/10 bg-app-surface px-4 py-3">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Principal</p>
          <p class="mt-1 truncate text-xl font-semibold text-white">
            {{ monitors.primaryMonitor()?.name ?? 'Nenhum' }}
          </p>
        </article>
        <article class="rounded-xl border border-white/10 bg-#16161a px-4 py-3">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Layout</p>
          <p class="mt-1 text-sm font-medium text-zinc-200">{{ layoutLabel() }}</p>
        </article>
      </section>

      <section class="min-h-0 flex-1 overflow-y-auto pr-2 scrollbar-thin">
        @if (monitors.loading() && monitors.monitors().length === 0) {
          <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            @for (item of skeletonItems; track item) {
              <article class="rounded-xl border border-white/5 bg-app-surface p-5">
                <span class="skeleton-shimmer block h-4 w-32 rounded"></span>
                <span class="skeleton-shimmer mt-4 block h-40 rounded-lg"></span>
                <span class="skeleton-shimmer mt-4 block h-9 w-48 rounded-lg"></span>
              </article>
            }
          </section>
        } @else if (monitors.monitors().length === 0) {
          <section
            class="flex h-full items-center justify-center rounded-xl border border-white/5 bg-app-panel"
          >
            <p class="text-sm text-zinc-500">Nenhum monitor encontrado.</p>
          </section>
        } @else {
          <section class="grid grid-cols-1 gap-4 xl:grid-cols-2">
            @for (monitor of monitors.monitors(); track monitor.id; let index = $index) {
              <article
                class="rounded-xl border bg-app-surface p-5 transition"
                [class.border-app-accent/50]="monitor.isPrimary"
                [class.border-white/10]="!monitor.isPrimary"
                [class.opacity-60]="!monitor.isEnabled"
              >
                <header class="flex items-start justify-between gap-4">
                  <section class="min-w-0">
                    <section class="flex min-w-0 items-center gap-2">
                      <h2 class="truncate text-base font-semibold text-white">
                        {{ monitor.name }}
                      </h2>
                      @if (monitor.isPrimary) {
                        <span
                          class="shrink-0 rounded-md bg-app-accent/15 px-2 py-0.5 text-xs font-medium text-app-accent-soft"
                        >
                          Principal
                        </span>
                      }
                    </section>
                    <p class="mt-1 truncate text-sm text-zinc-500">
                      {{ monitor.displayName || monitor.deviceName || monitor.connection }}
                    </p>
                  </section>
                  <span
                    class="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
                    [class.bg-emerald-500/10]="monitor.isEnabled"
                    [class.text-emerald-300]="monitor.isEnabled"
                    [class.bg-zinc-700/40]="!monitor.isEnabled"
                    [class.text-zinc-400]="!monitor.isEnabled"
                  >
                    {{ monitor.isEnabled ? 'Ativo' : 'Desativado' }}
                  </span>
                </header>

                <section class="mt-5 rounded-lg border border-white/5 bg-app-recessed p-4">
                  <section
                    class="mx-auto flex aspect-video w-full max-w-md items-center justify-center rounded-lg border transition"
                    [class.border-app-accent/45]="monitor.isPrimary"
                    [class.bg-app-screen]="monitor.isEnabled"
                    [class.border-white/10]="!monitor.isPrimary"
                    [class.bg-app-panel]="!monitor.isEnabled"
                  >
                    <section class="text-center">
                      <span class="text-4xl font-bold text-white">{{ index + 1 }}</span>
                      <p class="mt-1 text-xs uppercase tracking-wide text-zinc-500">
                        {{ resolutionLabel(monitor) }}
                      </p>
                    </section>
                  </section>
                  <section class="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-400">
                    <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                      {{ monitor.connection }}
                    </span>
                    <span class="rounded-lg bg-white/[0.03] px-3 py-2">
                      {{ positionLabel(monitor) }}
                    </span>
                  </section>
                </section>

                <footer class="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                    [disabled]="monitors.loading() || isLastEnabled(monitor)"
                    (click)="monitors.setEnabled(monitor, !monitor.isEnabled)"
                  >
                    {{ monitor.isEnabled ? 'Desativar' : 'Ativar' }}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg bg-app-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-app-accent-hover-soft disabled:opacity-40"
                    [disabled]="monitors.loading() || !monitor.isEnabled || monitor.isPrimary"
                    (click)="monitors.setPrimary(monitor)"
                  >
                    Tornar principal
                  </button>
                </footer>
              </article>
            }
          </section>
        }
      </section>
    </section>
  `,
})
export class MonitorsPageComponent implements OnInit {
  protected readonly monitors = inject(MonitorService);
  protected readonly skeletonItems = [1, 2];
  protected readonly layoutLabel = computed(() => {
    const enabled = this.monitors.enabledMonitors();
    if (enabled.length === 0) {
      return 'Sem telas ativas';
    }

    const positioned = enabled.filter(
      (monitor) =>
        monitor.x !== null &&
        monitor.y !== null &&
        monitor.width !== null &&
        monitor.height !== null,
    );

    return positioned.length === enabled.length
      ? 'Área de trabalho estendida'
      : 'Configuração parcial';
  });

  ngOnInit(): void {
    if (this.monitors.monitors().length === 0 && !this.monitors.loading()) {
      void this.monitors.refresh();
    }
  }

  protected isLastEnabled(monitor: MonitorInfo): boolean {
    return monitor.isEnabled && this.monitors.enabledCount() <= 1;
  }

  protected resolutionLabel(monitor: MonitorInfo): string {
    if (!monitor.isEnabled || monitor.width === null || monitor.height === null) {
      return 'Sem resolução ativa';
    }

    return `${monitor.width} x ${monitor.height}`;
  }

  protected positionLabel(monitor: MonitorInfo): string {
    if (!monitor.isEnabled || monitor.x === null || monitor.y === null) {
      return 'Sem posição';
    }

    return `${monitor.x}, ${monitor.y}`;
  }
}
