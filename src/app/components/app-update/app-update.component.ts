import { Component, inject } from '@angular/core';
import { UpdateService } from '../../services/update.service';

@Component({
  selector: 'ui-app-update',
  template: `
    @if (updates.status() === 'downloading') {
      <span class="text-xs text-app-accent-bright" data-drag-region="false">
        Baixando atualização v{{ updates.availableVersion() }}… {{ updates.progress() }}%
      </span>
    } @else if (updates.status() === 'ready') {
      <span class="text-xs text-app-accent-bright" data-drag-region="false">
        Atualização pronta — reiniciando…
      </span>
    } @else if (updates.status() === 'checking') {
      <span class="text-xs text-zinc-500" data-drag-region="false">Verificando atualizações…</span>
    } @else if (updates.status() === 'error') {
      <button
        type="button"
        class="max-w-lg rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-left text-xs text-amber-200 transition hover:bg-amber-500/15"
        [title]="updates.errorMessage() ?? ''"
        (click)="recheck()"
        data-drag-region="false"
      >
        {{ updates.errorMessage() ?? 'Falha na atualização' }} — tentar de novo
      </button>
    }
  `,
})
export class AppUpdateComponent {
  readonly updates = inject(UpdateService);

  recheck(): void {
    void this.updates.checkForUpdate();
  }
}
