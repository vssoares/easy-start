import { Component, inject } from '@angular/core';
import { UpdateService } from '../../services/update.service';

@Component({
  selector: 'ui-app-update',
  template: `
    @if (updates.hasUpdate()) {
      <button
        type="button"
        class="flex items-center gap-2 rounded-full border border-app-accent/40 bg-app-accent/10 px-3 py-1.5 text-sm font-medium text-app-accent-bright transition hover:bg-app-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
        [disabled]="updates.status() === 'installing'"
        (click)="install()"
        data-tauri-drag-region="false"
      >
        @if (updates.status() === 'installing') {
          <span>Instalando… {{ updates.progress() }}%</span>
        } @else {
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v12M7 8l5-5 5 5" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M5 21h14" stroke-linecap="round" />
          </svg>
          <span>Atualizar para v{{ updates.availableVersion() }}</span>
        }
      </button>
    } @else if (updates.status() === 'checking') {
      <span class="text-xs text-zinc-500" data-tauri-drag-region="false">Verificando atualizações…</span>
    } @else if (updates.status() === 'error') {
      <button
        type="button"
        class="max-w-lg rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-left text-xs text-amber-200 transition hover:bg-amber-500/15"
        [title]="updates.errorMessage() ?? ''"
        (click)="recheck()"
        data-tauri-drag-region="false"
      >
        {{ updates.errorMessage() ?? 'Falha na atualização' }} — tentar de novo
      </button>
    }
  `,
})
export class AppUpdateComponent {
  readonly updates = inject(UpdateService);

  install(): void {
    void this.updates.installUpdate();
  }

  recheck(): void {
    void this.updates.checkForUpdate();
  }
}
