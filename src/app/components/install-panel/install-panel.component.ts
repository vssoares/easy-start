import { Component, inject } from '@angular/core';
import { InstallService } from '../../services/install.service';

@Component({
  selector: 'ui-install-panel',
  template: `
    @if (install.selectedCount() > 0 || install.installing() || install.lastResults()) {
      <aside
        class="fixed bottom-0 left-14 right-0 z-50 border-t border-white/10 bg-[#121218]/95 px-8 py-4 backdrop-blur-md"
      >
        @if (install.error()) {
          <p class="mb-3 text-sm text-red-400">{{ install.error() }}</p>
        }

        @if (install.installing() && install.progress()) {
          <div class="mb-3">
            <div class="mb-1 flex items-center justify-between text-sm">
              <span class="text-zinc-300">
                Instalando {{ install.progress()!.name }} ({{ install.progress()!.index }}/{{
                  install.progress()!.total
                }})
              </span>
              <span class="text-zinc-500">{{ statusLabel(install.progress()!.status) }}</span>
            </div>
            <div class="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full bg-[#e8192c] transition-all duration-300"
                [style.width.%]="(install.progress()!.index / install.progress()!.total) * 100"
              ></div>
            </div>
          </div>
        }

        @if (install.lastResults() && !install.installing()) {
          <div class="mb-3 max-h-28 overflow-y-auto scrollbar-thin">
            @for (job of install.lastResults()!.jobs; track job.appId) {
              <div class="flex items-center justify-between py-0.5 text-xs">
                <span class="text-zinc-400">{{ job.name }}</span>
                <span [class]="statusClass(job.status)">{{ statusLabel(job.status) }}</span>
              </div>
            }
          </div>
        }

        <div class="flex items-center justify-between gap-4">
          <div class="text-sm text-zinc-400">
            <span class="font-medium text-white">{{ install.selectedCount() }}</span> selecionado(s)
            @if (install.unsupportedSelected().length > 0) {
              <span class="ml-2 text-amber-500/90">
                · {{ install.unsupportedSelected().length }} sem winget (serão ignorados)
              </span>
            }
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:text-white disabled:opacity-40"
              [disabled]="install.installing()"
              (click)="install.clearSelection()"
            >
              Limpar
            </button>
            <button
              type="button"
              class="rounded-lg bg-[#e8192c] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#c91425] disabled:cursor-not-allowed disabled:opacity-40"
              [disabled]="install.installableSelected().length === 0 || install.installing()"
              (click)="install.installSelected()"
            >
              @if (install.installing()) {
                Instalando...
              } @else {
                Instalar {{ install.installableSelected().length }} app(s)
              }
            </button>
          </div>
        </div>
      </aside>
    }
  `,
})
export class InstallPanelComponent {
  readonly install = inject(InstallService);

  statusLabel(status: string): string {
    switch (status) {
      case 'installing':
        return 'Instalando';
      case 'done':
        return 'Concluído';
      case 'skipped':
        return 'Já instalado';
      case 'failed':
        return 'Falhou';
      default:
        return 'Pendente';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'done':
        return 'text-emerald-400';
      case 'skipped':
        return 'text-zinc-500';
      case 'failed':
        return 'text-red-400';
      case 'installing':
        return 'text-amber-400';
      default:
        return 'text-zinc-500';
    }
  }
}
