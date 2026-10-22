import { Component, inject, OnInit } from '@angular/core';
import { NetworkService, Step } from '../../services/network.service';

@Component({
  selector: 'page-network',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 flex shrink-0 items-start justify-between gap-4">
        <section>
          <h1 class="text-2xl font-bold text-white">Rede</h1>
          <p class="mt-0.5 text-sm text-zinc-500">Diagnóstico de lag: latência, perda, DNS e velocidade</p>
        </section>
        <button
          type="button"
          class="rounded-lg bg-app-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-app-accent-hover-soft disabled:opacity-50"
          [disabled]="net.running()"
          (click)="net.runAll()"
        >
          {{ net.running() ? 'Testando…' : 'Testar rede' }}
        </button>
      </header>

      @if (net.error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ net.error() }}
        </p>
      } @else if (net.message()) {
        <p class="mb-4 shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {{ net.message() }}
        </p>
      }

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Teste de conexão</p>
          <p class="mb-2.5 text-[11px] text-zinc-600">
            Roteador alto indica Wi-Fi ruim; roteador bom e internet alta indica problema do provedor. Os testes de velocidade usam o
            servidor público speed.cloudflare.com e não gravam nada no disco.
          </p>

          @for (step of net.steps(); track step.id) {
            <div class="flex items-start gap-3 border-t border-white/5 py-3">
              <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" [class]="dot(step)"></span>
              <section class="min-w-0 flex-1">
                <h3 class="text-sm font-semibold text-white">{{ step.label }}</h3>
                <p class="text-[11px] text-zinc-600">{{ step.hint }}</p>
                @if (step.state === 'running') {
                  <p class="mt-1 text-xs text-zinc-400">Medindo…</p>
                } @else if (step.text) {
                  <p class="mt-1 font-mono text-xs" [class]="textClass(step)">{{ step.text }}</p>
                }
              </section>
            </div>
          }
        </article>

        <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
          <article class="rounded-xl border border-white/5 bg-app-surface p-5">
            <div class="mb-2 flex items-start justify-between gap-3">
              <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Endereços locais</p>
              <button
                type="button"
                class="rounded-lg border border-white/15 px-2.5 py-1 text-[11px] uppercase text-zinc-300 transition hover:border-white/25 hover:text-white"
                (click)="net.loadIps()"
              >
                Atualizar
              </button>
            </div>
            @for (ip of net.ips(); track ip.name + ip.address) {
              <div class="flex items-center justify-between gap-3 border-t border-white/5 py-2">
                <span class="min-w-0 truncate text-sm text-zinc-300">{{ ip.name }}</span>
                <span class="shrink-0 font-mono text-sm text-zinc-100">{{ ip.address }}</span>
              </div>
            } @empty {
              <p class="border-t border-white/5 pt-3 text-sm text-zinc-500">Nenhum endereço IPv4 encontrado.</p>
            }
          </article>

          <article class="rounded-xl border border-white/5 bg-app-surface p-5">
            <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Cache de DNS</p>
            <p class="mb-3 text-sm text-zinc-500">
              Limpa o cache de nomes do Windows. Resolve sites que não abrem depois de trocar de DNS ou de rede.
            </p>
            <button
              type="button"
              class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/25 hover:text-white"
              (click)="net.flushDns()"
            >
              Limpar cache DNS
            </button>
          </article>
        </div>
      </div>
    </section>
  `,
})
export class NetworkPageComponent implements OnInit {
  protected readonly net = inject(NetworkService);

  ngOnInit(): void {
    void this.net.loadIps();
  }

  dot(step: Step): string {
    if (step.state === 'running') return 'animate-pulse bg-app-accent';
    if (step.state === 'idle') return 'bg-white/15';
    return { ok: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-red-500', none: 'bg-zinc-400' }[step.level];
  }

  textClass(step: Step): string {
    return { ok: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-red-300', none: 'text-zinc-200' }[step.level];
  }
}
