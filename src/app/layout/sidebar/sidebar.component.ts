import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NavItem } from '../../models/program.model';
import { UpdateService } from '../../services/update.service';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <aside class="flex h-full w-14 flex-col items-center overflow-visible border-r border-white/5 bg-[#0a0a0c] py-3">
      <div class="mb-6 flex h-8 w-8 items-center justify-center">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L4 6v6c0 5.5 3.4 10.7 8 12 4.6-1.3 8-6.5 8-12V6l-8-4z" fill="#e8192c" />
          <path d="M12 8v8M8 12h8" stroke="white" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </div>

      <nav class="flex flex-1 flex-col items-center gap-1">
        @for (item of items(); track item.id) {
          <a
            [routerLink]="item.route"
            routerLinkActive="sidebar-active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="sidebar-link relative flex h-10 w-10 items-center justify-center rounded-xl text-zinc-500 transition-colors duration-150"
            [attr.aria-label]="item.label"
          >
            @switch (item.icon) {
              @case ('home') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
                </svg>
              }
              @case ('network') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
                </svg>
              }
              @case ('library') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="3" y="3" width="8" height="8" rx="1.5" />
                  <rect x="13" y="3" width="8" height="8" rx="1.5" />
                  <rect x="3" y="13" width="8" height="8" rx="1.5" />
                  <rect x="13" y="13" width="8" height="8" rx="1.5" />
                </svg>
              }
              @case ('store') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M6 6h15l-1.5 9h-12L6 6zM6 6L5 3H2" />
                  <circle cx="9" cy="20" r="1" />
                  <circle cx="18" cy="20" r="1" />
                </svg>
              }
              @case ('stats') {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M4 20V10M10 20V4M16 20v-8M22 20V14" stroke-linecap="round" />
                </svg>
              }
              @default {
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                </svg>
              }
            }
          </a>
        }
      </nav>

      <div class="mt-auto flex flex-col items-center gap-2 pb-2">
        <button
          type="button"
          class="sidebar-btn relative flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors duration-150"
          aria-label="Configurações"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="3" />
            <path
              d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
            />
          </svg>
          @if (updates.hasUpdate()) {
            <span class="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#e8192c]"></span>
          }
        </button>
        <button
          type="button"
          class="sidebar-btn flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors duration-150"
          aria-label="Ajuda"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.5 9.5a2.5 2.5 0 014.5 1.5c0 2-2.5 2-2.5 4M12 17h.01" stroke-linecap="round" />
          </svg>
        </button>
        <button
          type="button"
          class="sidebar-btn flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 transition-colors duration-150"
          aria-label="Perfil"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </button>
        @if (updates.currentVersion()) {
          <span class="mt-1 text-[9px] text-zinc-600">v{{ updates.currentVersion() }}</span>
        }
      </div>
    </aside>
  `,
  styles: `
    :host {
      display: flex;
      height: 100%;
      align-self: stretch;
      flex-shrink: 0;
    }

    :host ::ng-deep .sidebar-link:not(.sidebar-active):hover,
    :host ::ng-deep .sidebar-btn:hover {
      background: #1e1e24;
      color: #e4e4e7;
    }

    :host ::ng-deep .sidebar-active {
      color: #e8192c;
      background: rgba(232, 25, 44, 0.14);
    }

    :host ::ng-deep .sidebar-active:hover {
      background: rgba(232, 25, 44, 0.18);
    }

    :host ::ng-deep .sidebar-active::before {
      content: '';
      position: absolute;
      left: -8px;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 22px;
      background: #e8192c;
      border-radius: 9999px;
    }
  `,
})
export class SidebarComponent {
  readonly items = input.required<NavItem[]>();
  protected readonly updates = inject(UpdateService);
}
