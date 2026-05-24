import { Component } from '@angular/core';

@Component({
  selector: 'ui-window-controls',
  template: `
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="flex h-8 w-10 items-center justify-center text-zinc-400 transition hover:bg-white/10 hover:text-white"
        (click)="minimize()"
        aria-label="Minimizar"
      >
        <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor">
          <rect width="10" height="1" />
        </svg>
      </button>
      <button
        type="button"
        class="flex h-8 w-10 items-center justify-center text-zinc-400 transition hover:bg-white/10 hover:text-white"
        (click)="toggleMaximize()"
        aria-label="Maximizar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="0.5" y="0.5" width="9" height="9" />
        </svg>
      </button>
      <button
        type="button"
        class="flex h-8 w-10 items-center justify-center text-zinc-400 transition hover:bg-red-600 hover:text-white"
        (click)="close()"
        aria-label="Fechar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.2">
          <path d="M1 1L9 9M9 1L1 9" />
        </svg>
      </button>
    </div>
  `,
})
export class WindowControlsComponent {
  private async getWindow() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    return getCurrentWindow();
  }

  async minimize(): Promise<void> {
    const win = await this.getWindow();
    await win.minimize();
  }

  async toggleMaximize(): Promise<void> {
    const win = await this.getWindow();
    if (await win.isMaximized()) {
      await win.unmaximize();
    } else {
      await win.maximize();
    }
  }

  async close(): Promise<void> {
    const win = await this.getWindow();
    await win.close();
  }
}
