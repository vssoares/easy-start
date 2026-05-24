import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WindowControlsComponent } from '../../components/window-controls/window-controls.component';

@Component({
  selector: 'app-topbar',
  imports: [FormsModule, WindowControlsComponent],
  template: `
    <header
      class="flex h-12 shrink-0 items-center border-b border-white/5 bg-[#0f0f12] px-4"
      data-tauri-drag-region
    >
      <div class="w-14 shrink-0"></div>

      <div class="flex flex-1 justify-center" data-tauri-drag-region>
        <!-- <label class="relative w-full max-w-md">
          <svg
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
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
            [(ngModel)]="globalSearch"
            placeholder="Procurar"
            class="w-full rounded-full border border-white/10 bg-[#1a1a1f] py-2 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-500 outline-none transition focus:border-[#e8192c]/50 focus:ring-1 focus:ring-[#e8192c]/30"
            data-tauri-drag-region="false"
          />
        </label> -->
      </div>

      <ui-window-controls />
    </header>
  `,
})
export class TopbarComponent {
  globalSearch = '';
}
