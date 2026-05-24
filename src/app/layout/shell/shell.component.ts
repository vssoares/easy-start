import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NAV_ITEMS } from '../../data/programs.data';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="flex h-full w-full overflow-hidden bg-[#0f0f12] text-white">
      <app-sidebar [items]="navItems" />

      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar />
        <main class="min-h-0 flex-1 overflow-hidden">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
  `,
})
export class ShellComponent {
  readonly navItems = NAV_ITEMS;
}
