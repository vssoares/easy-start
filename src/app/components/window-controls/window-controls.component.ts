import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { invoke, isDesktop, listen } from '../../core/desktop';

@Component({
  selector: 'ui-window-controls',
  template: `
    <div
      class="traffic-lights group flex items-center gap-2"
      data-drag-region="false"
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
export class WindowControlsComponent implements OnInit, OnDestroy {
  readonly maximized = signal(false);

  private stopListening: (() => void) | null = null;

  ngOnInit(): void {
    if (!isDesktop()) {
      return;
    }

    this.stopListening = listen<boolean>('window-maximized', (value) => this.maximized.set(value));
    void this.syncMaximized();
  }

  ngOnDestroy(): void {
    this.stopListening?.();
  }

  private async syncMaximized(): Promise<void> {
    try {
      this.maximized.set(await invoke<boolean>('window_is_maximized'));
    } catch {
      this.maximized.set(false);
    }
  }

  minimize(): Promise<void> {
    return invoke('window_minimize');
  }

  toggleMaximize(): Promise<void> {
    return invoke(this.maximized() ? 'window_unmaximize' : 'window_maximize');
  }

  close(): Promise<void> {
    return invoke('window_close');
  }
}
