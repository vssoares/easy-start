import { Component, input, output } from '@angular/core';
import { CategoryItem, ProgramCategory } from '../../models/program.model';

@Component({
  selector: 'ui-category-nav',
  template: `
    <nav class="flex w-40 shrink-0 flex-col gap-0.5 overflow-y-auto pt-2 scrollbar-thin">
      @for (category of categories(); track category.id) {
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-left text-xs transition"
          [class]="
            activeCategory() === category.id
              ? 'font-medium text-app-accent'
              : 'text-zinc-400 hover:text-zinc-200'
          "
          (click)="categoryChange.emit(category.id)"
        >
          {{ category.label }}
        </button>
      }
    </nav>
  `,
})
export class CategoryNavComponent {
  readonly categories = input.required<CategoryItem[]>();
  readonly activeCategory = input.required<ProgramCategory>();
  readonly categoryChange = output<ProgramCategory>();
}
