import { Component, input } from '@angular/core';

@Component({
  selector: 'ui-node-skeleton',
  template: `
    @if (mode() === 'full') {
      <section class="mb-6 grid grid-cols-1 gap-3 md:grid-cols-3">
        @for (card of cards; track card) {
          <article class="rounded-xl border border-white/5 bg-[#16161a] px-4 py-3">
            <span class="skeleton-shimmer block h-3 w-20 rounded"></span>
            <span
              class="skeleton-shimmer mt-3 block h-7 rounded"
              [class]="card === 2 ? 'w-28' : 'w-16'"
            ></span>
          </article>
        }
      </section>

      <section class="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
        @for (panel of panels; track panel) {
          <article class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#121218]">
            <header class="border-b border-white/5 px-4 py-3">
              <span
                class="skeleton-shimmer block h-4 rounded"
                [class]="panel === 2 ? 'w-36' : 'w-28'"
              ></span>
              @if (panel === 2) {
                <span class="skeleton-shimmer mt-3 block h-9 w-full rounded-lg"></span>
              }
            </header>
            <section class="space-y-2 p-2">
              @for (row of rowItems(); track row) {
                <span class="flex items-center justify-between rounded-lg px-3 py-2.5">
                  <span class="flex items-center gap-2">
                    <span class="skeleton-shimmer block h-4 w-16 rounded"></span>
                    <span class="skeleton-shimmer block h-4 w-10 rounded"></span>
                  </span>
                  <span class="skeleton-shimmer block h-7 w-16 rounded-md"></span>
                </span>
              }
            </section>
          </article>
        }
      </section>
    } @else {
      <section class="space-y-2 p-1">
        @for (row of rowItems(); track row) {
          <span class="flex items-center justify-between rounded-lg px-3 py-2.5">
            <span class="flex items-center gap-2">
              <span class="skeleton-shimmer block h-4 w-16 rounded"></span>
              <span class="skeleton-shimmer block h-4 w-10 rounded"></span>
            </span>
            <span class="skeleton-shimmer block h-7 w-16 rounded-md"></span>
          </span>
        }
      </section>
    }
  `,
})
export class NodeSkeletonComponent {
  readonly mode = input<'full' | 'rows'>('full');
  readonly rowItems = input([1, 2, 3, 4, 5, 6]);

  readonly cards = [1, 2, 3];
  readonly panels = [1, 2];
}
