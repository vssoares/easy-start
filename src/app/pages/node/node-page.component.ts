import { Component, computed, inject, input, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NodeVersionRowComponent } from '../../components/node-version-row/node-version-row.component';
import { NodeVersionInfo } from '../../models/node.model';
import { NodeManagerService } from '../../services/node-manager.service';

const SKELETON_CARDS = [1, 2, 3];
const SKELETON_PANELS = [1, 2];

@Component({
  selector: 'ui-node-skeleton',
  standalone: true,
  template: `
    @if (mode() === 'full') {
      <section class="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        @for (card of skeletonCards; track card) {
          <article class="rounded-xl border border-white/5 bg-[#16161a] px-4 py-3">
            <span class="skeleton-shimmer block h-3 w-20 rounded"></span>
            <span
              class="skeleton-shimmer mt-3 block h-7 rounded"
              [class]="card === 2 ? 'w-28' : 'w-16'"
            ></span>
          </article>
        }
      </section>

      <section class="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        @for (panel of skeletonPanels; track panel) {
          <article
            class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#121218]"
          >
            <header class="border-b border-white/5 px-4 py-3">
              <span
                class="skeleton-shimmer block h-4 rounded"
                [class]="panel === 2 ? 'w-36' : 'w-28'"
              ></span>
              @if (panel === 2) {
                <span class="skeleton-shimmer mt-3 block h-9 w-full rounded-lg"></span>
              }
            </header>
            <section class="space-y-2 p-2">
              @for (row of rowItems(); track row) {
                <span class="flex items-center justify-between rounded-lg px-3 py-2.5">
                  <span class="flex items-center gap-2">
                    <span class="skeleton-shimmer block h-4 w-16 rounded"></span>
                    <span class="skeleton-shimmer block h-4 w-10 rounded"></span>
                  </span>
                  <span class="skeleton-shimmer block h-7 w-16 rounded-md"></span>
                </span>
              }
            </section>
          </article>
        }
      </section>
    } @else {
      <section class="space-y-2 p-1">
        @for (row of rowItems(); track row) {
          <span class="flex items-center justify-between rounded-lg px-3 py-2.5">
            <span class="flex items-center gap-2">
              <span class="skeleton-shimmer block h-4 w-16 rounded"></span>
              <span class="skeleton-shimmer block h-4 w-10 rounded"></span>
            </span>
            <span class="skeleton-shimmer block h-7 w-16 rounded-md"></span>
          </span>
        }
      </section>
    }
  `,
})
export class NodeSkeletonComponent {
  readonly mode = input<'full' | 'rows'>('full');
  readonly rowItems = input<number[]>([1, 2, 3, 4, 5, 6]);

  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly skeletonPanels = SKELETON_PANELS;
}

@Component({
  selector: 'page-node',
  standalone: true,
  imports: [FormsModule, NodeVersionRowComponent, NodeSkeletonComponent],
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-6 pt-6">
      <header class="mb-6 flex shrink-0 items-start justify-between gap-4">
        <section>
          <h1 class="text-2xl font-bold text-white">Node.js</h1>
          <p class="mt-0.5 text-sm text-zinc-500">Gerenciador de versões via NVM for Windows</p>
        </section>
        <button
          type="button"
          class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          [disabled]="node.loading()"
          (click)="node.refresh()"
        >
          Atualizar
        </button>
      </header>

      @if (node.error()) {
        <p class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ node.error() }}
        </p>
      }

      @if (showSkeleton()) {
        <ui-node-skeleton class="flex min-h-0 flex-1 flex-col" />
      } @else {
        @if (!status()?.installed) {
          <section
            class="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-500/20 bg-amber-500/5 px-5 py-4"
          >
            <section>
              <p class="font-medium text-amber-200">NVM for Windows não detectado</p>
              <p class="mt-1 text-sm text-zinc-400">
                Instale automaticamente para gerenciar versões do Node.
              </p>
            </section>
            <button
              type="button"
              class="shrink-0 rounded-lg bg-[#e8192c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c91425] disabled:opacity-40"
              [disabled]="node.loading()"
              (click)="node.ensureNvm()"
            >
              Instalar NVM
            </button>
          </section>
        } @else {
          <section class="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            <article class="rounded-xl border border-white/10 bg-[#16161a] px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Versão ativa</p>
              <p class="mt-1 text-xl font-semibold text-white">
                {{ status()?.currentVersion ?? 'Nenhuma' }}
              </p>
            </article>
            <article class="rounded-xl border border-white/10 bg-[#16161a] px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">NVM</p>
              <p class="mt-1 text-sm text-zinc-200">{{ status()?.nvmVersion }}</p>
            </article>
            <article class="rounded-xl border border-white/10 bg-[#16161a] px-4 py-3">
              <p class="text-xs uppercase tracking-wide text-zinc-500">Instaladas</p>
              <p class="mt-1 text-xl font-semibold text-white">{{ installedCount() }}</p>
            </article>
          </section>
        }

        <section class="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
          <article class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121218]">
            <header class="border-b border-white/10 px-4 py-3">
              <h2 class="text-sm font-semibold text-white">Versões instaladas</h2>
            </header>
            <section class="relative min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
              @if (refreshing() && installedVersions().length === 0) {
                <ui-node-skeleton mode="rows" />
              } @else if (installedVersions().length === 0) {
                <p class="px-2 py-8 text-center text-sm text-zinc-500">Nenhuma versão instalada.</p>
              } @else {
                <section [class.opacity-40]="refreshing()">
                  @for (item of installedVersions(); track item.version) {
                    <ui-node-version-row
                      [item]="item"
                      mode="installed"
                      [busy]="isBusy(item.version)"
                      [disabled]="node.loading()"
                      (install)="node.install($event)"
                      (uninstall)="node.uninstall($event)"
                      (useVersion)="node.use($event)"
                    />
                  }
                </section>
                @if (refreshing()) {
                  <ui-node-skeleton
                    mode="rows"
                    class="pointer-events-none absolute inset-0 z-10 bg-[#121218]/70 p-2"
                  />
                }
              }
            </section>
          </article>

          <article class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#121218]">
            <header class="border-b border-white/10 px-4 py-3">
              <section class="flex items-center justify-between gap-3">
                <h2 class="text-sm font-semibold text-white">Versões LTS disponíveis</h2>
                <span class="text-xs text-zinc-500">{{ filteredAvailableVersions().length }} LTS</span>
              </section>
              <input
                type="search"
                [(ngModel)]="versionSearch"
                placeholder="Buscar LTS (ex: 14, 18, 22)..."
                class="mt-3 w-full rounded-lg border border-white/10 bg-[#16161a] px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none transition focus:border-[#e8192c]/40"
                [disabled]="node.loading()"
              />
            </header>
            <section class="relative min-h-0 flex-1 overflow-y-auto p-2 scrollbar-thin">
              @if (refreshing() && filteredAvailableVersions().length === 0) {
                <ui-node-skeleton mode="rows" />
              } @else if (filteredAvailableVersions().length === 0) {
                <p class="px-2 py-8 text-center text-sm text-zinc-500">Nenhuma versão LTS disponível.</p>
              } @else {
                <section [class.opacity-40]="refreshing()">
                  @for (item of filteredAvailableVersions(); track item.version) {
                    <ui-node-version-row
                      [item]="item"
                      mode="available"
                      [busy]="isBusy(item.version)"
                      [disabled]="node.loading() || !status()?.installed"
                      (install)="node.install($event)"
                      (uninstall)="node.uninstall($event)"
                      (useVersion)="node.use($event)"
                    />
                  }
                </section>
                @if (refreshing()) {
                  <ui-node-skeleton
                    mode="rows"
                    class="pointer-events-none absolute inset-0 z-10 bg-[#121218]/70 p-2"
                  />
                }
              }
            </section>
          </article>
        </section>
      }
    </section>
  `,
})
export class NodePageComponent implements OnInit {
  readonly node = inject(NodeManagerService);

  readonly status = computed(() => this.node.data()?.status);
  readonly showSkeleton = computed(() => this.node.loading() && this.node.data() === null);
  readonly refreshing = computed(
    () => this.node.loading() && this.node.data() !== null && !this.node.actionVersion(),
  );
  readonly installedVersions = computed(() =>
    this.sortVersions(this.node.data()?.installed ?? []),
  );
  readonly availableVersions = computed(() =>
    this.sortVersions(this.node.data()?.available ?? []),
  );
  readonly filteredAvailableVersions = computed(() => {
    const query = this.versionSearch.trim();
    if (!query) {
      return this.availableVersions();
    }
    return this.availableVersions().filter((item) => item.version.includes(query));
  });
  readonly installedCount = computed(() => this.installedVersions().length);

  versionSearch = '';

  ngOnInit(): void {
    if (!this.node.data() && !this.node.loading()) {
      void this.node.refresh();
    }
  }

  isBusy(version: string): boolean {
    return this.node.actionVersion() === version && this.node.loading();
  }

  private sortVersions(items: NodeVersionInfo[]): NodeVersionInfo[] {
    return [...items].sort((a, b) => this.compareVersions(b.version, a.version));
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pb[i] ?? 0) - (pa[i] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  }
}
