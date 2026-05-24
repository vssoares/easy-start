import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'page-placeholder',
  template: `
    <section class="flex h-full items-center justify-center p-8">
      <div class="text-center">
        <h1 class="text-2xl font-bold text-white">{{ title }}</h1>
        <p class="mt-2 text-sm text-zinc-500">Em breve</p>
      </div>
    </section>
  `,
})
export class PlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = this.route.snapshot.data['title'] as string;
}
