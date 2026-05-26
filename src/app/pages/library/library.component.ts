import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InstallPanelComponent } from '../../components/install-panel/install-panel.component';
import { ProgramCheckItemComponent } from '../../components/program-check-item/program-check-item.component';
import { CATEGORIES, PROGRAMS } from '../../data/programs.data';
import { Program, ProgramCategory } from '../../models/program.model';
import { InstallService } from '../../services/install.service';

interface CategoryGroup {
  id: ProgramCategory;
  label: string;
  programs: Program[];
}

@Component({
  selector: 'page-library',
  imports: [FormsModule, ProgramCheckItemComponent, InstallPanelComponent],
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-28 pt-6">
      <header class="mb-4 flex shrink-0 items-start justify-between gap-4">
        <section>
          <h1 class="text-2xl font-bold text-white">Instalar programas</h1>
          <p class="mt-0.5 text-sm text-zinc-500">
            {{ programsCount }} apps disponíveis — selecione e instale em lote via winget
          </p>
        </section>
        <button
          type="button"
          class="shrink-0 rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          [disabled]="install.installing()"
          (click)="selectVisible()"
        >
          Selecionar visíveis
        </button>
      </header>

      <label class="relative mb-5 block shrink-0">
        <svg
          class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3-3" stroke-linecap="round" />
        </svg>
        <input
          type="search"
          [(ngModel)]="librarySearch"
          placeholder="Procurar apps..."
          class="w-full rounded-lg border border-white/10 bg-app-surface py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none transition focus:border-app-accent/40"
        />
      </label>

      <section class="min-h-0 flex-1 overflow-y-auto pr-2 scrollbar-thin">
        @if (categoryGroups().length === 0) {
          <p class="py-12 text-center text-sm text-zinc-500">Nenhum app encontrado.</p>
        } @else {
          <section
            class="columns-2 gap-x-8 md:columns-3 lg:columns-4 xl:columns-5 2xl:columns-7"
          >
            @for (group of categoryGroups(); track group.id) {
              <article class="mb-7 break-inside-avoid">
                <h2
                  class="mb-2 border-b border-white/10 pb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400"
                >
                  {{ group.label }}
                </h2>
                <ul class="space-y-0.5">
                  @for (program of group.programs; track program.id) {
                    <li>
                      <ui-program-check-item
                        [program]="program"
                        [selected]="install.isSelected(program.id)"
                        (toggle)="install.toggleSelection(program.id)"
                      />
                    </li>
                  }
                </ul>
              </article>
            }
          </section>
        }
      </section>
    </section>

    <ui-install-panel />
  `,
})
export class LibraryComponent {
  readonly install = inject(InstallService);
  readonly programsCount = PROGRAMS.length;

  librarySearch = '';

  readonly filteredPrograms = computed(() => {
    const query = this.librarySearch.trim().toLowerCase();
    if (!query) {
      return PROGRAMS;
    }

    return PROGRAMS.filter(
      (program) =>
        program.name.toLowerCase().includes(query) ||
        program.niniteSlug.toLowerCase().includes(query),
    );
  });

  readonly categoryGroups = computed((): CategoryGroup[] => {
    const byCategory = new Map<ProgramCategory, Program[]>();

    for (const program of this.filteredPrograms()) {
      const list = byCategory.get(program.category) ?? [];
      list.push(program);
      byCategory.set(program.category, list);
    }

    return CATEGORIES.filter((category) => category.id !== 'todos')
      .map((category) => ({
        id: category.id,
        label: category.label,
        programs: (byCategory.get(category.id) ?? []).sort((a, b) =>
          a.name.localeCompare(b.name, 'pt-BR'),
        ),
      }))
      .filter((group) => group.programs.length > 0);
  });

  selectVisible(): void {
    this.install.selectAll(this.filteredPrograms());
  }
}
