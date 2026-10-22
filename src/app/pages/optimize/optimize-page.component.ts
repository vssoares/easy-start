import { Component, inject, OnInit } from '@angular/core';
import { BackgroundApp, Tweak } from '../../models/optimize.model';
import { OptimizeService } from '../../services/optimize.service';

@Component({
  selector: 'page-optimize',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 shrink-0">
        <h1 class="text-2xl font-bold text-white">Otimização</h1>
        <p class="mt-0.5 text-sm text-zinc-500">Libera memória, fecha o que atrapalha e ajusta o Windows para jogos</p>
      </header>

      @if (opt.error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ opt.error() }}
        </p>
      }

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        <!-- Botão principal -->
        <article class="flex flex-wrap items-center gap-6 rounded-xl border border-white/5 bg-app-surface px-6 py-5">
          <section class="min-w-64 flex-1">
            <div class="flex items-baseline justify-between">
              <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Memória RAM</p>
              @if (opt.memory(); as mem) {
                <p class="font-mono text-sm text-zinc-200">
                  {{ gb(mem.usedMb) }} / {{ gb(mem.totalMb) }} GB · {{ mem.percent }}%
                </p>
              }
            </div>
            <div class="mb-3 mt-2 h-1.5 w-full rounded-full bg-white/10">
              <div
                class="h-full rounded-full bg-app-accent transition-all"
                [style.width]="(opt.memory()?.percent ?? 0) + '%'"
              ></div>
            </div>
            <p class="text-sm text-zinc-500">
              Um clique: limpa a memória em espera e fecha os programas marcados na lista abaixo. Use antes de abrir um jogo.
            </p>
            @if (opt.result(); as result) {
              <p class="mt-2.5 text-sm text-zinc-300">{{ result }}</p>
            }
          </section>

          <button
            type="button"
            class="rounded-lg bg-app-accent px-9 py-4 text-base font-bold uppercase tracking-wide text-white transition hover:bg-app-accent-hover-soft disabled:opacity-50"
            [disabled]="opt.optimizing()"
            (click)="optimize()"
          >
            {{ opt.optimizing() ? 'Otimizando…' : 'Otimizar' }}
          </button>
        </article>

        <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <!-- Programas -->
          <article class="rounded-xl border border-white/5 bg-app-surface p-5">
            <div class="mb-1.5 flex items-start justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Programas para fechar</p>
              <button
                type="button"
                class="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] uppercase text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                [disabled]="opt.optimizing()"
                (click)="opt.refreshApps()"
              >
                Atualizar
              </button>
            </div>
            <p class="mb-2.5 text-[11px] text-zinc-600">
              Marcados = seguros de fechar durante o jogo. Programas com janela recebem o pedido de fechar (como clicar no X) e não
              são forçados, para não perder nada não salvo.
            </p>

            @for (app of opt.apps(); track app.processName) {
              <label class="flex cursor-pointer items-center gap-3 border-t border-white/5 py-2">
                <input
                  type="checkbox"
                  class="h-4 w-4 shrink-0 accent-[#e8192c]"
                  [checked]="opt.selectedApps().has(app.processName)"
                  (change)="opt.toggleApp(app.processName)"
                />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm text-zinc-100">{{ app.title }}</span>
                  <span class="block truncate text-[11px] text-zinc-600">{{ appDetail(app) }}</span>
                </span>
                <span class="shrink-0 font-mono text-xs text-zinc-400">{{ memoryText(app.memoryBytes) }}</span>
              </label>
            } @empty {
              <p class="border-t border-white/5 pt-3 text-sm text-zinc-500">Nenhum programa para fechar.</p>
            }
          </article>

          <!-- Ajustes do Windows -->
          <article class="rounded-xl border border-white/5 bg-app-surface p-5">
            <div class="mb-1.5 flex items-start justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Ajustes do Windows para jogos</p>
              <button
                type="button"
                class="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[11px] uppercase text-zinc-300 transition hover:border-white/25 hover:text-white"
                (click)="opt.restoreTweaks()"
              >
                Restaurar originais
              </button>
            </div>
            <p class="mb-2.5 text-[11px] text-zinc-600">
              A caixa mostra o estado atual e aplica na hora. O valor original é guardado na primeira alteração. Não mexemos em
              segurança (Defender, Integridade de Memória, UAC, Windows Update).
            </p>

            @for (tweak of opt.tweaks(); track tweak.id) {
              <label class="flex cursor-pointer items-start gap-3 border-t border-white/5 py-2.5">
                <input
                  type="checkbox"
                  class="mt-1 h-4 w-4 shrink-0 accent-[#e8192c]"
                  [checked]="tweak.isOn"
                  (change)="onTweak($event, tweak)"
                />
                <span class="min-w-0 flex-1">
                  <span class="flex items-start justify-between gap-3">
                    <span class="text-sm font-semibold text-white">{{ tweak.title }}</span>
                    @if (tweak.needsRestart) {
                      <span class="mt-0.5 shrink-0 text-[9.5px] font-bold uppercase text-zinc-400">Requer reiniciar</span>
                    }
                  </span>
                  <span class="mt-0.5 block text-xs text-zinc-400">{{ tweak.description }}</span>
                  <span class="mt-0.5 block text-[11px] text-zinc-600">{{ tweak.effect }}</span>
                  @if (opt.tweakStatus()[tweak.id]; as status) {
                    <span class="mt-0.5 block text-[11px] text-zinc-300">{{ status }}</span>
                  }
                </span>
              </label>
            }
          </article>
        </div>
      </div>
    </section>
  `,
})
export class OptimizePageComponent implements OnInit {
  protected readonly opt = inject(OptimizeService);

  ngOnInit(): void {
    void this.opt.load();
  }

  optimize(): void {
    const apps = this.opt.selectedAppList();
    const list = apps.length ? apps.map((app) => `  • ${app.title}`).join('\n') : 'nenhum programa marcado';
    const ok = confirm(
      `A otimização vai:\n\n1. Fechar os programas marcados:\n${list}\n2. Limpar a memória em espera e enxugar a RAM dos programas.\n\nSalve o que estiver aberto nesses programas antes. Continuar?`,
    );
    if (ok) void this.opt.optimize();
  }

  async onTweak(event: Event, tweak: Tweak): Promise<void> {
    const input = event.target as HTMLInputElement;
    await this.opt.setTweak(tweak, input.checked);
    // A caixa só reflete o estado real do sistema.
    input.checked = this.opt.tweaks().find((t) => t.id === tweak.id)?.isOn ?? false;
  }

  appDetail(app: BackgroundApp): string {
    return app.count > 1 ? `${app.detail} · ${app.count} processos` : app.detail;
  }

  memoryText(bytes: number): string {
    return `${Math.round(bytes / 1048576).toLocaleString('pt-BR')} MB`;
  }

  gb(mb: number): string {
    return (mb / 1024).toFixed(1);
  }
}
