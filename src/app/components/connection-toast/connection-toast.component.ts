import { Component, signal } from '@angular/core';

@Component({
  selector: 'ui-connection-toast',
  template: `
    @if (visible()) {
      <aside
        class="fixed bottom-6 right-6 flex items-center gap-3 rounded-lg border border-white/10 bg-app-elevated px-4 py-2.5 shadow-2xl"
      >
        <div
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-app-accent to-app-accent-dark text-[10px] font-bold text-white"
        >
          FH
        </div>
        <span class="text-sm text-zinc-300">Avalie sua conexão</span>
        <button
          type="button"
          class="ml-2 text-zinc-500 transition hover:text-white"
          (click)="visible.set(false)"
          aria-label="Fechar"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 7.5L6 4.5L9 7.5" />
          </svg>
        </button>
      </aside>
    }
  `,
})
export class ConnectionToastComponent {
  readonly visible = signal(true);
}
