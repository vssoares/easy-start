import { Component, inject, OnInit, signal } from '@angular/core';
import { invoke, isDesktop } from '../../core/desktop';
import { UpdateService } from '../../services/update.service';

const STATUS_TEXT: Record<string, string> = {
  idle: 'Você está na versão mais recente.',
  checking: 'Procurando atualização…',
  downloading: 'Baixando atualização…',
  ready: 'Atualização pronta. Ela será instalada ao fechar o app.',
  error: 'Não foi possível verificar.',
  skipped: 'Atualização automática desligada (modo de desenvolvimento).',
};

@Component({
  selector: 'page-settings',
  standalone: true,
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 shrink-0">
        <h1 class="text-2xl font-bold text-white">Configurações</h1>
        <p class="mt-0.5 text-sm text-zinc-500">Versão, atualizações e permissões do app</p>
      </header>

      @if (error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {{ error() }}
        </p>
      }

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Atualizações</p>
          <div class="flex flex-wrap items-center justify-between gap-4">
            <section>
              <p class="text-sm text-zinc-200">
                Versão <span class="font-mono">{{ updates.currentVersion() || '—' }}</span>
              </p>
              <p class="mt-0.5 text-sm text-zinc-500">
                {{ statusText() }}
                @if (updates.status() === 'downloading') {
                  <span class="font-mono">{{ updates.progress() }}%</span>
                }
              </p>
              @if (updates.errorMessage()) {
                <p class="mt-1 text-xs text-red-300">{{ updates.errorMessage() }}</p>
              }
            </section>
            <button
              type="button"
              class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/25 hover:text-white disabled:opacity-40"
              [disabled]="updates.status() === 'checking' || updates.status() === 'downloading'"
              (click)="updates.checkForUpdate()"
            >
              Verificar agora
            </button>
          </div>
        </article>

        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Permissões</p>
          <p class="text-sm text-zinc-200">
            Administrador:
            <span [class]="admin() === true ? 'text-emerald-400' : 'text-amber-300'">{{ adminText() }}</span>
          </p>
          <p class="mt-1 text-sm text-zinc-500">
            Limpar a lista de espera da RAM, mexer em HKLM, remover dispositivos e drivers exigem administrador. Para ligar, feche o
            app e abra com "Executar como administrador".
          </p>
        </article>

        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Dados do app</p>
          <p class="mb-3 text-sm text-zinc-500">
            Aqui ficam os backups que permitem desfazer: ajustes do Windows, programas removidos da inicialização e reservas de porta
            COM.
          </p>
          <button
            type="button"
            class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/25 hover:text-white"
            (click)="open('open_data_folder')"
          >
            Abrir pasta de dados
          </button>
        </article>

        <article class="rounded-xl border border-white/5 bg-app-surface p-5">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Projeto</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-lg border border-white/10 bg-app-panel px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white" (click)="link('https://github.com/vssoares/easy-start')">Repositório</button>
            <button type="button" class="rounded-lg border border-white/10 bg-app-panel px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white" (click)="link('https://github.com/vssoares/easy-start/releases/latest')">Últimas versões</button>
            <button type="button" class="rounded-lg border border-white/10 bg-app-panel px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white" (click)="link('https://github.com/vssoares/easy-start/issues')">Reportar problema</button>
          </div>
        </article>
      </div>
    </section>
  `,
})
export class SettingsPageComponent implements OnInit {
  protected readonly updates = inject(UpdateService);
  protected readonly admin = signal<boolean | null>(null);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    if (!isDesktop()) return;
    invoke<boolean>('is_admin')
      .then((value) => this.admin.set(value))
      .catch(() => this.admin.set(null));
  }

  statusText(): string {
    return STATUS_TEXT[this.updates.status()] ?? '';
  }

  adminText(): string {
    const admin = this.admin();
    return admin === null ? 'não foi possível verificar' : admin ? 'sim' : 'não';
  }

  open(command: 'open_data_folder'): void {
    this.run(() => invoke(command));
  }

  link(url: string): void {
    this.run(() => invoke('open_link', { url }));
  }

  private run(action: () => Promise<unknown>): void {
    this.error.set(null);
    if (!isDesktop()) {
      this.error.set('Disponível apenas no app desktop (Electron).');
      return;
    }
    action().catch((err) => this.error.set(err instanceof Error ? err.message : String(err)));
  }
}
