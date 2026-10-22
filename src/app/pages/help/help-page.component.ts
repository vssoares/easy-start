import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FAQ, SECTIONS } from '../../data/sections.data';

@Component({
  selector: 'page-help',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 shrink-0">
        <h1 class="text-2xl font-bold text-white">Ajuda</h1>
        <p class="mt-0.5 text-sm text-zinc-500">O que cada área faz e respostas para as dúvidas mais comuns</p>
      </header>

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Áreas do app</p>
          @for (section of sections; track section.route) {
            <a
              [routerLink]="section.route"
              class="block border-t border-white/5 py-3 transition hover:bg-white/[0.02]"
            >
              <h3 class="text-sm font-semibold text-white">{{ section.label }}</h3>
              <p class="mt-0.5 text-sm text-zinc-400">{{ section.description }}</p>
              <p class="mt-0.5 text-xs text-zinc-600">{{ section.tip }}</p>
            </a>
          }
        </article>

        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Perguntas frequentes</p>
          @for (item of faq; track item.question) {
            <details class="group border-t border-white/5 py-3">
              <summary class="cursor-pointer list-none text-sm font-semibold text-white marker:hidden">
                {{ item.question }}
              </summary>
              <p class="mt-2 text-sm text-zinc-400">{{ item.answer }}</p>
            </details>
          }
        </article>
      </div>
    </section>
  `,
})
export class HelpPageComponent {
  protected readonly sections = SECTIONS;
  protected readonly faq = FAQ;
}
