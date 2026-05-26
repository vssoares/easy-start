import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NAV_ITEMS } from '../../data/programs.data';
import { UpdateService } from '../../services/update.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, SidebarComponent, TopbarComponent],
  template: `
    <div class="flex h-full w-full overflow-hidden bg-app-bg text-white">
      <app-sidebar [items]="navItems()" />

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
export class ShellComponent implements OnInit {
  private readonly updates = inject(UpdateService);
  readonly navItems = signal(NAV_ITEMS);

  ngOnInit(): void {
    void this.updates.init();
  }
}
