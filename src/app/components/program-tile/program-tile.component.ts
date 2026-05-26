import { Component, input, output } from '@angular/core';
import { Program } from '../../models/program.model';

@Component({
  selector: 'ui-program-tile',
  template: `
    <button
      type="button"
      class="group relative flex w-full flex-col items-center gap-2 rounded-xl p-1 text-left transition"
      [class.ring-2]="selected()"
      [class.ring-app-accent]="selected()"
      [class.opacity-50]="!installable()"
      (click)="toggle.emit()"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="program().name"
    >
      <div class="relative">
        <div
          class="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-xl text-sm font-bold text-white shadow-lg transition group-hover:scale-105"
          [style.background]="tileBackground()"
        >
          {{ program().initial }}
        </div>
        @if (selected()) {
          <span
            class="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-app-accent text-white"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 5.5L4 7.5L8 3" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </span>
        } @else if (!installable()) {
          <span
            class="absolute -right-1 -top-1 rounded bg-zinc-800 px-1 text-[8px] text-zinc-400"
            title="Sem suporte winget"
          >
            N/A
          </span>
        }
      </div>
      <p class="max-w-[88px] truncate text-center text-[11px] text-zinc-300">{{ program().name }}</p>
    </button>
  `,
})
export class ProgramTileComponent {
  readonly program = input.required<Program>();
  readonly selected = input(false);
  readonly installable = input(true);
  readonly toggle = output<void>();

  tileBackground(): string {
    const color = this.program().color;
    return `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 60%, black))`;
  }
}
