import { Component, input, output } from '@angular/core';
import { NodeVersionInfo } from '../../models/node.model';

@Component({
  selector: 'ui-node-version-row',
  template: `
    <article
      class="mb-1 flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition"
      [class.bg-[#e8192c]/10]="item().active"
      [class.border]="item().active"
      [class.border-[#e8192c]/30]="item().active"
    >
      <section class="min-w-0">
        <section class="flex items-center gap-2">
          <span class="font-mono text-sm text-white">v{{ item().version }}</span>
          @if (item().active) {
            <span class="rounded bg-[#e8192c]/20 px-1.5 py-0.5 text-[10px] font-medium text-[#ff6b7a]">
              Ativa
            </span>
          }
          @if (item().lts) {
            <span class="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
              {{ item().lts }}
            </span>
          }
        </section>
      </section>

      <section class="flex shrink-0 items-center gap-1">
        @if (mode() === 'available' && !item().installed) {
          <button
            type="button"
            class="rounded-md bg-[#e8192c] px-2.5 py-1 text-xs font-medium text-white transition hover:bg-[#c91425] disabled:opacity-40"
            [disabled]="disabled() || busy()"
            (click)="install.emit(item().version)"
          >
            {{ busy() ? '...' : 'Instalar' }}
          </button>
        }

        @if (item().installed) {
          @if (!item().active) {
            <button
              type="button"
              class="rounded-md border border-white/15 px-2.5 py-1 text-xs text-zinc-300 transition hover:text-white disabled:opacity-40"
              [disabled]="disabled() || busy()"
              (click)="useVersion.emit(item().version)"
            >
              {{ busy() ? '...' : 'Usar' }}
            </button>
          }
          <button
            type="button"
            class="rounded-md px-2.5 py-1 text-xs text-zinc-500 transition hover:text-red-400 disabled:opacity-40"
            [disabled]="disabled() || busy() || item().active"
            (click)="uninstall.emit(item().version)"
          >
            Remover
          </button>
        }
      </section>
    </article>
  `,
})
export class NodeVersionRowComponent {
  readonly item = input.required<NodeVersionInfo>();
  readonly mode = input<'installed' | 'available'>('available');
  readonly busy = input(false);
  readonly disabled = input(false);

  readonly install = output<string>();
  readonly uninstall = output<string>();
  readonly useVersion = output<string>();
}
