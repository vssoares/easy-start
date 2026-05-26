import { Component, input, output } from '@angular/core';

@Component({
  selector: 'ui-alphabet-index',
  template: `
    <aside class="flex w-5 shrink-0 flex-col items-center gap-0.5 py-2">
      @for (letter of letters(); track letter) {
        <button
          type="button"
          class="text-[9px] leading-none transition"
          [class]="
            activeLetter() === letter
              ? 'font-semibold text-app-accent'
              : 'text-zinc-600 hover:text-zinc-400'
          "
          (click)="letterSelect.emit(letter)"
        >
          {{ letter }}
        </button>
      }
    </aside>
  `,
})
export class AlphabetIndexComponent {
  readonly letters = input.required<string[]>();
  readonly activeLetter = input<string | null>(null);
  readonly letterSelect = output<string>();
}
