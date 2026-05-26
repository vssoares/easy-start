import { Component, computed, input, output, signal } from '@angular/core';
import { getProgramIconUrl } from '../../data/program-icons.data';
import { Program } from '../../models/program.model';

@Component({
  selector: 'ui-program-check-item',
  template: `
    <button
      type="button"
      class="group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-white/5"
      [class.bg-app-accent/10]="selected()"
      [attr.aria-pressed]="selected()"
      [attr.aria-label]="program().name"
      (click)="toggle.emit()"
    >
      <span
        class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition"
        [class.border-app-accent]="selected()"
        [class.bg-app-accent]="selected()"
        [class.border-white/20]="!selected()"
        [class.group-hover:border-white/35]="!selected()"
      >
        @if (selected()) {
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="white" stroke-width="1.5">
            <path d="M2 5.5L4 7.5L8 3" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        }
      </span>

      @if (iconUrl() && !iconFailed()) {
        <img
          [src]="iconUrl()!"
          alt=""
          class="h-4 w-4 shrink-0 object-contain"
          loading="lazy"
          (error)="iconFailed.set(true)"
        />
      } @else {
        <span
          class="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[7px] font-bold text-white"
          [style.background]="program().color"
        >
          {{ program().initial }}
        </span>
      }

      <span
        class="min-w-0 flex-1 truncate text-[13px] transition"
        [class.text-white]="selected()"
        [class.text-zinc-300]="!selected()"
        [class.group-hover:text-white]="!selected()"
      >
        {{ program().name }}
      </span>
    </button>
  `,
})
export class ProgramCheckItemComponent {
  readonly program = input.required<Program>();
  readonly selected = input(false);
  readonly toggle = output<void>();

  readonly iconFailed = signal(false);
  readonly iconUrl = computed(() => getProgramIconUrl(this.program().niniteSlug));
}
