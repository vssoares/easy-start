import { Component, computed, inject, OnInit } from '@angular/core';
import { StartupEntry } from '../../models/tools.model';
import { ToolsService } from '../../services/tools.service';

@Component({
  selector: 'page-startup',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 flex shrink-0 items-start justify-between gap-4">
        <section>
          <h1 class="text-2xl font-bold text-white">Inicialização</h1>
          <p class="mt-0.5 text-sm text-zinc-500">Programas que abrem junto com o Windows · desative ou remova o que não precisa</p>
        </section>
        <button
          type="button"
          class="rounded-lg bg-app-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-app-accent-hover-soft disabled:opacity-50"
          [disabled]="tools.loading()"
          (click)="tools.loadStartup()"
        >
          {{ tools.loading() ? 'Carregando...' : 'Atualizar' }}
        </button>
      </header>

      @if (tools.error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ tools.error() }}
        </p>
      } @else if (tools.toast()) {
        <p class="mb-4 shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {{ tools.toast() }}
        </p>
      }

      <div class="min-h-0 flex-1 overflow-y-auto pr-2 scrollbar-thin">
        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">{{ summary() }}</p>

          @if (tools.loading() && tools.startup().length === 0) {
            @for (item of skeletons; track item) {
              <span class="skeleton-shimmer mb-2 block h-14 rounded-lg"></span>
            }
          }

          @for (entry of tools.startup(); track entry.source + entry.name) {
            <div class="flex items-center gap-3 border-t border-white/5 py-3">
              <input
                type="checkbox"
                class="h-4 w-4 shrink-0 accent-[#e8192c]"
                [checked]="entry.enabled"
                [disabled]="tools.loading()"
                [attr.aria-label]="'Abrir ' + entry.name + ' com o Windows'"
                (change)="tools.setStartupEnabled(entry, !entry.enabled)"
              />
              <section class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="truncate text-sm font-semibold text-white">{{ entry.name }}</h3>
                  <span class="text-[9.5px] font-bold uppercase" [class]="stateClass(entry)">{{ state(entry) }}</span>
                </div>
                @if (entry.detail) {
                  <p class="truncate text-xs text-zinc-400">{{ entry.detail }}</p>
                }
                <p class="truncate text-[11px] text-zinc-600" [title]="entry.command">{{ entry.source }} · {{ entry.command }}</p>
              </section>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs uppercase text-zinc-300 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
                [disabled]="tools.loading()"
                (click)="remove(entry)"
              >
                Remover
              </button>
            </div>
          } @empty {
            @if (!tools.loading()) {
              <p class="border-t border-white/5 pt-3 text-sm text-zinc-500">Nenhum programa de inicialização encontrado.</p>
            }
          }
        </article>

        @if (tools.removed().length > 0) {
          <article class="mt-4 rounded-xl border border-white/5 bg-app-surface p-5">
            <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Removidos</p>
            @for (item of tools.removed(); track item.removedAt) {
              <div class="flex items-center justify-between gap-4 border-t border-white/5 py-2.5">
                <section class="min-w-0">
                  <h3 class="truncate text-sm text-zinc-200">{{ item.name }}</h3>
                  <p class="text-[11px] text-zinc-600">{{ formatDate(item.removedAt) }}</p>
                </section>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-white/15 px-3 py-1.5 text-xs uppercase text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                  [disabled]="tools.loading()"
                  (click)="tools.restoreStartup(item)"
                >
                  Restaurar
                </button>
              </div>
            }
          </article>
        }
      </div>
    </section>
  `,
})
export class StartupPageComponent implements OnInit {
  protected readonly tools = inject(ToolsService);
  protected readonly skeletons = [1, 2, 3, 4];

  protected readonly summary = computed(() => {
    const list = this.tools.startup();
    const active = list.filter((entry) => entry.enabled).length;
    return `Programas de inicialização · ${list.length} no total · ${active} ativos`;
  });

  ngOnInit(): void {
    void this.tools.loadStartup();
  }

  state(entry: StartupEntry): string {
    if (entry.fileMissing) return 'Arquivo não existe';
    return entry.enabled ? 'Ativado' : 'Desativado';
  }

  stateClass(entry: StartupEntry): string {
    if (entry.fileMissing) return 'text-amber-300';
    return entry.enabled ? 'text-emerald-400' : 'text-zinc-500';
  }

  remove(entry: StartupEntry): void {
    if (confirm(`Remover "${entry.name}" da inicialização? Dá para restaurar depois.`)) {
      void this.tools.removeStartup(entry);
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('pt-BR');
  }
}
