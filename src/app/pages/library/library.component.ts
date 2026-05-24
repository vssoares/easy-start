import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlphabetIndexComponent } from '../../components/alphabet-index/alphabet-index.component';
import { CategoryNavComponent } from '../../components/category-nav/category-nav.component';
import { InstallPanelComponent } from '../../components/install-panel/install-panel.component';
import { ProgramTileComponent } from '../../components/program-tile/program-tile.component';
import { ALPHABET, CATEGORIES, PROGRAMS } from '../../data/programs.data';
import { ProgramCategory } from '../../models/program.model';
import { InstallService } from '../../services/install.service';

@Component({
  selector: 'page-library',
  imports: [
    FormsModule,
    CategoryNavComponent,
    ProgramTileComponent,
    AlphabetIndexComponent,
    InstallPanelComponent,
  ],
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-28 pt-6">
      <header class="mb-4 flex shrink-0 items-start justify-between">
        <div class="flex-1">
          <h1 class="text-2xl font-bold text-white">Instalar programas</h1>
          <p class="mt-0.5 text-sm text-zinc-500">
            {{ programsCount }} apps do Ninite — clique para selecionar e instale em lote
          </p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/25 hover:text-white disabled:opacity-40"
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
          class="w-full rounded-lg border border-white/10 bg-[#16161a] py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none transition focus:border-[#e8192c]/40"
        />
      </label>

      <div class="flex min-h-0 flex-1 gap-4">
        <ui-category-nav
          [categories]="categories"
          [activeCategory]="activeCategory()"
          (categoryChange)="activeCategory.set($event)"
        />

        <div class="min-h-0 flex-1 overflow-y-auto pr-2 scrollbar-thin">
          <div class="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-x-3 gap-y-5">
            @for (program of filteredPrograms(); track program.id) {
              <ui-program-tile
                [program]="program"
                [selected]="install.isSelected(program.id)"
                [installable]="!!program.wingetId"
                (toggle)="install.toggleSelection(program.id)"
              />
            } @empty {
              <p class="col-span-full py-12 text-center text-sm text-zinc-500">
                Nenhum app encontrado.
              </p>
            }
          </div>
        </div>

        <ui-alphabet-index
          [letters]="alphabet"
          [activeLetter]="activeLetter()"
          (letterSelect)="onLetterSelect($event)"
        />
      </div>
    </section>

    <ui-install-panel />
  `,
})
export class LibraryComponent {
  readonly install = inject(InstallService);
  readonly categories = CATEGORIES;
  readonly alphabet = ALPHABET;
  readonly programsCount = PROGRAMS.length;

  readonly activeCategory = signal<ProgramCategory>('todos');
  readonly activeLetter = signal<string | null>(null);
  librarySearch = '';

  readonly filteredPrograms = computed(() => {
    const category = this.activeCategory();
    const query = this.librarySearch.trim().toLowerCase();
    const letter = this.activeLetter();

    return PROGRAMS.filter((program) => {
      const matchesCategory = category === 'todos' || program.category === category;
      const matchesSearch =
        !query ||
        program.name.toLowerCase().includes(query) ||
        program.niniteSlug.toLowerCase().includes(query);
      const matchesLetter =
        !letter || program.name.toUpperCase().startsWith(letter.toUpperCase());

      return matchesCategory && matchesSearch && matchesLetter;
    });
  });

  selectVisible(): void {
    this.install.selectAll(this.filteredPrograms());
  }

  onLetterSelect(letter: string): void {
    this.activeLetter.update((current) => (current === letter ? null : letter));
  }
}
