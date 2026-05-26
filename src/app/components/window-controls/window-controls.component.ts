import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'ui-window-controls',
  template: `
    <div
      class="traffic-lights group flex items-center gap-2"
      data-tauri-drag-region="false"
      role="toolbar"
      aria-label="Controles da janela"
    >
      <button
        type="button"
        class="traffic-btn traffic-close"
        (click)="close()"
        aria-label="Fechar"
      >
        <svg class="traffic-icon" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 2l6 6M8 2L2 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="traffic-btn traffic-minimize"
        (click)="minimize()"
        aria-label="Minimizar"
      >
        <svg class="traffic-icon" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1.5 5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
        </svg>
      </button>
      <button
        type="button"
        class="traffic-btn traffic-maximize"
        (click)="toggleMaximize()"
        [attr.aria-label]="maximized() ? 'Restaurar' : 'Maximizar'"
      >
        @if (maximized()) {
          <svg class="traffic-icon" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1.5" y="2.5" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1" />
            <rect x="4" y="1" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
        } @else {
          <svg class="traffic-icon" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="2" y="2" width="6" height="6" fill="none" stroke="currentColor" stroke-width="1" />
          </svg>
        }
      </button>
    </div>
  `,
  styles: `
    .traffic-btn {
      position: relative;
      display: flex;
      height: 1.75rem;
      width: 1.75rem;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      border: none;
      padding: 0;
      cursor: default;
      transition: filter 0.15s ease;
    }

    .traffic-btn::before {
      content: '';
      height: 0.75rem;
      width: 0.75rem;
      border-radius: 9999px;
      transition: filter 0.15s ease;
    }

    .traffic-close::before {
      background: #ff5f57;
    }

    .traffic-minimize::before {
      background: #febc2e;
    }

    .traffic-maximize::before {
      background: #28c840;
    }

    .traffic-btn:hover::before {
      filter: brightness(0.92);
    }

    .traffic-btn:active::before {
      filter: brightness(0.85);
    }

    .traffic-icon {
      position: absolute;
      height: 0.625rem;
      width: 0.625rem;
      color: rgba(0, 0, 0, 0.55);
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.12s ease;
    }

    .traffic-lights:hover .traffic-icon,
    .traffic-btn:focus-visible .traffic-icon {
      opacity: 1;
    }

    .traffic-btn:focus-visible {
      outline: 2px solid rgba(255, 255, 255, 0.25);
      outline-offset: 2px;
    }
  `,
})
export class WindowControlsComponent implements OnInit {
  readonly maximized = signal(false);

  ngOnInit(): void {
    void this.syncMaximized();
  }

  private async getWindow() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow();
  }

  private async syncMaximized(): Promise<void> {
    try {
      const win = await this.getWindow();
      this.maximized.set(await win.isMaximized());
    } catch {
      this.maximized.set(false);
    }
  }

  async minimize(): Promise<void> {
    const win = await this.getWindow();
    await win.minimize();
  }

  async toggleMaximize(): Promise<void> {
    const win = await this.getWindow();
    if (await win.isMaximized()) {
      await win.unmaximize();
      this.maximized.set(false);
    } else {
      await win.maximize();
      this.maximized.set(true);
    }
  }

  async close(): Promise<void> {
    const win = await this.getWindow();
    await win.close();
  }
}
