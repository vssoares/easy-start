import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { UsbDevice } from '../../models/maker.model';
import { MakerService } from '../../services/maker.service';

type MakerTab = 'devices' | 'com' | 'drivers' | 'ghosts';

const TABS: { id: MakerTab; label: string }[] = [
  { id: 'devices', label: 'Placas conectadas' },
  { id: 'com', label: 'Portas COM' },
  { id: 'drivers', label: 'Drivers seriais' },
  { id: 'ghosts', label: 'Dispositivos antigos' },
];

@Component({
  selector: 'page-maker',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-5 flex shrink-0 items-start justify-between gap-4">
        <section>
          <h1 class="text-2xl font-bold text-white">Maker</h1>
          <p class="mt-0.5 text-sm text-zinc-500">Arduino, ESP e conversores seriais: CH340, CP210x, FTDI e Prolific</p>
        </section>
        <button
          type="button"
          class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          [disabled]="maker.loading()"
          (click)="reload()"
        >
          {{ maker.loading() ? 'Carregando...' : 'Atualizar' }}
        </button>
      </header>

      <nav class="mb-4 flex shrink-0 gap-2">
        @for (item of tabs; track item.id) {
          <button
            type="button"
            class="rounded-lg px-4 py-2 text-sm transition"
            [class]="
              tab() === item.id
                ? 'bg-app-accent font-medium text-white'
                : 'border border-white/10 bg-app-panel text-zinc-300 hover:border-white/20 hover:text-white'
            "
            (click)="select(item.id)"
          >
            {{ item.label }}
          </button>
        }
      </nav>

      @if (maker.error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ maker.error() }}
        </p>
      } @else if (maker.toast()) {
        <p class="mb-4 shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {{ maker.toast() }}
        </p>
      }

      <div class="min-h-0 flex-1 space-y-3 overflow-y-auto pr-2 scrollbar-thin">
        @switch (tab()) {
          @case ('devices') {
            @if (maker.loading() && maker.devices().length === 0) {
              @for (item of skeletons; track item) {
                <span class="skeleton-shimmer block h-28 rounded-xl"></span>
              }
            } @else if (maker.devices().length === 0) {
              <p class="rounded-xl border border-white/5 bg-app-surface p-5 text-sm text-zinc-500">
                Nenhuma placa ou conversor serial conectado. Plugue o cabo USB e clique em Atualizar.
              </p>
            }

            @for (device of maker.devices(); track device.instanceId) {
              <article
                class="rounded-xl border bg-app-surface p-5"
                [class]="device.ok ? 'border-white/5' : 'border-amber-500/40'"
              >
                <header class="flex flex-wrap items-start justify-between gap-3">
                  <section class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <h3 class="truncate text-base font-semibold text-white">{{ device.name }}</h3>
                      <span
                        class="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
                        [class]="device.ok ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'"
                      >
                        {{ device.ok ? 'Funcionando' : 'Com problema' }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-zinc-500">
                      {{ deviceDetail(device) }}
                    </p>
                  </section>
                  <div class="flex shrink-0 gap-2">
                    <button
                      type="button"
                      class="rounded-lg border border-white/10 bg-app-panel px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                      [disabled]="maker.loading()"
                      (click)="maker.reinstall(device)"
                    >
                      Reinstalar
                    </button>
                    <button
                      type="button"
                      class="rounded-lg border border-white/10 bg-app-panel px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                      [disabled]="maker.loading()"
                      (click)="maker.openOfficialPage(device.officialUrl)"
                    >
                      Página oficial
                    </button>
                  </div>
                </header>

                <p class="mt-3 text-sm" [class]="device.ok ? 'text-zinc-300' : 'text-amber-200'">{{ device.verdict }}</p>
                @if (device.advice) {
                  <p class="mt-1 text-sm text-zinc-400">{{ device.advice }}</p>
                }
                <p class="mt-2 text-xs text-zinc-500">Driver: {{ device.driver }}</p>
              </article>
            }
          }

          @case ('com') {
            <article class="rounded-xl border border-white/5 bg-app-surface p-5">
              <h2 class="text-base font-semibold text-white">Números de porta COM presos</h2>
              <p class="mt-1 text-sm text-zinc-500">
                O Windows reserva um número de COM para cada dispositivo que já foi plugado. Com o tempo a IDE do Arduino passa a
                receber COM20+ e deixa de achar a placa. Liberar mantém reservadas só as portas em uso agora (precisa de
                administrador, e o valor antigo fica guardado para desfazer).
              </p>

              @if (maker.com(); as com) {
                <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div class="rounded-lg border border-white/5 bg-app-panel px-4 py-3">
                    <dt class="text-xs uppercase tracking-wide text-zinc-500">Reservadas</dt>
                    <dd class="mt-1 text-sm text-zinc-100">{{ portList(com.reserved) }}</dd>
                  </div>
                  <div class="rounded-lg border border-white/5 bg-app-panel px-4 py-3">
                    <dt class="text-xs uppercase tracking-wide text-zinc-500">Em uso agora</dt>
                    <dd class="mt-1 text-sm text-zinc-100">{{ portList(com.inUse) }}</dd>
                  </div>
                </dl>
                <p class="mt-3 text-sm" [class]="stuckPorts() > 0 ? 'text-amber-200' : 'text-emerald-300'">
                  {{ stuckPorts() > 0 ? stuckPorts() + ' número(s) preso(s) podem ser liberados.' : 'Nenhum número preso.' }}
                </p>
              }

              <div class="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  class="rounded-lg bg-app-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-app-accent-hover-soft disabled:opacity-50"
                  [disabled]="maker.loading() || stuckPorts() === 0"
                  (click)="maker.rebuildComDb()"
                >
                  Liberar números presos
                </button>
                <button
                  type="button"
                  class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
                  [disabled]="maker.loading()"
                  (click)="maker.restoreComDb()"
                >
                  Desfazer
                </button>
              </div>
            </article>
          }

          @case ('drivers') {
            <p class="text-sm text-zinc-500">
              Versões dos drivers de chips seriais guardadas no Windows. Se uma versão nova quebrou clones de CH340, FTDI ou
              Prolific, remova-a para o Windows voltar a usar a anterior. Para instalar um driver, use a página oficial do
              fabricante na aba Placas conectadas.
            </p>

            @if (maker.loading() && maker.packages().length === 0) {
              @for (item of skeletons; track item) {
                <span class="skeleton-shimmer block h-16 rounded-xl"></span>
              }
            } @else if (maker.packages().length === 0) {
              <p class="rounded-xl border border-white/5 bg-app-surface p-5 text-sm text-zinc-500">
                Nenhum driver de chip serial instalado no Windows.
              </p>
            }

            @for (pkg of maker.packages(); track pkg.publishedName) {
              <article class="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-app-surface px-5 py-4">
                <section class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="truncate text-sm font-semibold text-white">{{ pkg.chip }} · {{ pkg.provider }} {{ pkg.version }}</h3>
                    @if (pkg.inUse) {
                      <span class="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">Em uso</span>
                    }
                  </div>
                  <p class="mt-0.5 truncate text-xs text-zinc-500">
                    {{ pkg.originalName }} → {{ pkg.publishedName }} · {{ pkg.date }}
                  </p>
                </section>
                <button
                  type="button"
                  class="shrink-0 rounded-lg border border-white/10 bg-app-panel px-3 py-2 text-sm text-zinc-200 transition hover:border-red-500/40 hover:text-red-300 disabled:opacity-40"
                  [disabled]="maker.loading()"
                  (click)="removePackage(pkg.publishedName, pkg.chip)"
                >
                  Remover versão
                </button>
              </article>
            }
          }

          @case ('ghosts') {
            <article class="rounded-xl border border-white/5 bg-app-surface p-5">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <section class="max-w-2xl">
                  <h2 class="text-base font-semibold text-white">Dispositivos USB e seriais antigos</h2>
                  <p class="mt-1 text-sm text-zinc-500">
                    Registros de dispositivos que não estão mais conectados (fantasmas). Remover é seguro: ao plugar de novo, o
                    Windows reinstala. Só ausentes podem ser removidos, e precisa de administrador.
                  </p>
                </section>
                <button
                  type="button"
                  class="rounded-lg bg-app-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-app-accent-hover-soft disabled:opacity-50"
                  [disabled]="maker.loading() || maker.selectedGhosts().size === 0"
                  (click)="removeGhosts()"
                >
                  Remover selecionados ({{ maker.selectedGhosts().size }})
                </button>
              </div>

              @if (maker.loading() && maker.ghosts().length === 0) {
                <span class="skeleton-shimmer mt-4 block h-32 rounded-lg"></span>
              } @else if (maker.ghosts().length === 0) {
                <p class="mt-4 text-sm text-zinc-500">Nenhum dispositivo antigo encontrado.</p>
              }

              <ul class="mt-4 space-y-2">
                @for (device of maker.ghosts(); track device.instanceId) {
                  <li>
                    <label
                      class="flex cursor-pointer items-center gap-3 rounded-lg border border-white/5 bg-app-panel px-4 py-2.5 transition hover:border-white/15"
                    >
                      <input
                        type="checkbox"
                        class="h-4 w-4 accent-[#e8192c]"
                        [checked]="maker.selectedGhosts().has(device.instanceId)"
                        (change)="maker.toggleGhost(device.instanceId)"
                      />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-sm text-zinc-100">{{ device.name }}</span>
                        <span class="block truncate text-xs text-zinc-500">{{ ghostDetail(device) }}</span>
                      </span>
                    </label>
                  </li>
                }
              </ul>
            </article>
          }
        }
      </div>
    </section>
  `,
})
export class MakerPageComponent implements OnInit {
  protected readonly maker = inject(MakerService);
  protected readonly tabs = TABS;
  protected readonly skeletons = [1, 2, 3];
  protected readonly tab = signal<MakerTab>('devices');

  /** Números reservados no ComDB que nenhum dispositivo está usando. */
  protected readonly stuckPorts = computed(() => {
    const com = this.maker.com();
    return com ? com.reserved.filter((n) => !com.inUse.includes(n)).length : 0;
  });

  ngOnInit(): void {
    this.reload();
  }

  select(tab: MakerTab): void {
    this.tab.set(tab);
    this.reload();
  }

  reload(): void {
    switch (this.tab()) {
      case 'devices':
        void this.maker.loadDevices();
        break;
      case 'com':
        void this.maker.loadCom();
        break;
      case 'drivers':
        void this.maker.loadPackages();
        break;
      case 'ghosts':
        void this.maker.loadGhosts();
        break;
    }
  }

  removePackage(publishedName: string, chip: string): void {
    if (confirm(`Remover o driver ${chip} (${publishedName}) do Windows?`)) {
      const pkg = this.maker.packages().find((p) => p.publishedName === publishedName);
      if (pkg) void this.maker.removePackage(pkg);
    }
  }

  removeGhosts(): void {
    const count = this.maker.selectedGhosts().size;
    if (confirm(`Remover ${count} dispositivo(s) antigo(s) do Windows?`)) {
      void this.maker.removeSelectedGhosts();
    }
  }

  deviceDetail(device: { port: string | null; chip: string; vid: string | null; pid: string | null }): string {
    return [device.port, device.chip, `VID ${device.vid} PID ${device.pid}`].filter(Boolean).join(' · ');
  }

  ghostDetail(device: UsbDevice): string {
    return [device.port, device.maker, device.class, device.vid ? `VID ${device.vid} PID ${device.pid}` : null]
      .filter(Boolean)
      .join(' · ');
  }

  portList(ports: number[]): string {
    return ports.length ? ports.map((n) => `COM${n}`).join(', ') : 'nenhuma';
  }
}
