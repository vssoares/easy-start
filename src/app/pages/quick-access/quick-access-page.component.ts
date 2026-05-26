import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuickFolder, SystemTool } from '../../models/quick-access.model';
import { QuickAccessService } from '../../services/quick-access.service';

const FOLDERS: QuickFolder[] = [
  { id: 'downloads', label: 'Downloads' },
  { id: 'desktop', label: 'Área de trabalho' },
  { id: 'documents', label: 'Documentos' },
  { id: 'temp', label: 'Temp' },
  { id: 'appdata', label: 'AppData' },
  { id: 'localappdata', label: 'AppData local' },
  { id: 'home', label: 'Perfil do usuário' },
];

const SYSTEM_TOOLS: SystemTool[] = [
  { id: 'taskmgr', label: 'Gerenciador de tarefas', description: 'taskmgr' },
  { id: 'hosts', label: 'Arquivo hosts', description: 'Bloco de notas' },
  { id: 'env', label: 'Variáveis de ambiente', description: 'sysdm.cpl' },
  { id: 'services', label: 'Serviços Windows', description: 'services.msc' },
];

@Component({
  selector: 'page-quick-access',
  imports: [FormsModule],
  template: `
    <section class="flex h-full flex-col overflow-hidden px-8 pb-8 pt-6">
      <header class="mb-6 shrink-0">
        <h1 class="text-2xl font-bold text-white">Acesso rápido</h1>
        <p class="mt-0.5 text-sm text-zinc-500">Atalhos e utilitários do dia a dia no Windows</p>
      </header>

      @if (quick.error()) {
        <p class="mb-4 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {{ quick.error() }}
        </p>
      } @else if (quick.toast()) {
        <p class="mb-4 shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {{ quick.toast() }}
        </p>
      }

      <div class="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-thin">
        <!-- Porta -->
        <article class="rounded-xl border border-white/5 bg-[#16161a] p-5">
          <h2 class="text-base font-semibold text-white">Porta em uso</h2>
          <p class="mt-1 text-sm text-zinc-500">
            Verifique ou encerre processos em portas como 4200, 3000 ou 8080.
          </p>

          <div class="mt-4 flex flex-wrap items-end gap-3">
            <label class="block">
              <span class="mb-1 block text-xs text-zinc-500">Porta</span>
              <input
                type="number"
                min="1"
                max="65535"
                [(ngModel)]="portInput"
                class="w-32 rounded-lg border border-white/10 bg-[#121218] px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-[#e8192c]/40"
                [disabled]="quick.loading()"
              />
            </label>
            <button
              type="button"
              class="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/25 hover:text-white disabled:opacity-50"
              [disabled]="quick.loading()"
              (click)="onInspectPort()"
            >
              Verificar
            </button>
            <button
              type="button"
              class="rounded-lg bg-[#e8192c] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#c91424] disabled:opacity-50"
              [disabled]="quick.loading()"
              (click)="onKillPort()"
            >
              Encerrar porta
            </button>
          </div>

          @if (quick.lastInspectResult(); as inspect) {
            <p class="mt-3 text-sm text-zinc-300">{{ inspect.message }}</p>
          } @else if (quick.lastKillResult(); as kill) {
            <p
              class="mt-3 text-sm"
              [class]="kill.killed.length ? 'text-emerald-400' : 'text-zinc-400'"
            >
              {{ kill.message }}
            </p>
          }
        </article>

        <!-- Pastas -->
        <article class="rounded-xl border border-white/5 bg-[#16161a] p-5">
          <h2 class="text-base font-semibold text-white">Abrir pastas</h2>
          <p class="mt-1 text-sm text-zinc-500">Atalhos para pastas usadas no dia a dia.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            @for (folder of folders; track folder.id) {
              <button
                type="button"
                class="rounded-lg border border-white/10 bg-[#121218] px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
                [disabled]="quick.loading()"
                (click)="openFolder(folder.id)"
              >
                {{ folder.label }}
              </button>
            }
          </div>
        </article>

        <!-- Rede -->
        <article class="rounded-xl border border-white/5 bg-[#16161a] p-5">
          <h2 class="text-base font-semibold text-white">Rede</h2>
          <p class="mt-1 text-sm text-zinc-500">DNS e endereços IPv4 locais.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-white/10 bg-[#121218] px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              [disabled]="quick.loading()"
              (click)="flushDns()"
            >
              Limpar cache DNS
            </button>
            <button
              type="button"
              class="rounded-lg border border-white/10 bg-[#121218] px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              [disabled]="quick.loading()"
              (click)="loadIps()"
            >
              Ver IPs locais
            </button>
            <button
              type="button"
              class="rounded-lg border border-white/10 bg-[#121218] px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              [disabled]="quick.loading() || !quick.localIps()?.length"
              (click)="copyIps()"
            >
              Copiar IPs
            </button>
          </div>
          @if (quick.localIps(); as ips) {
            <ul class="mt-3 space-y-1 text-sm text-zinc-400">
              @for (ip of ips; track ip.address + ip.name) {
                <li>
                  <span class="text-zinc-500">{{ ip.name }}:</span>
                  <button
                    type="button"
                    class="ml-1 text-zinc-200 underline-offset-2 hover:text-white hover:underline"
                    (click)="copyIp(ip.address)"
                  >
                    {{ ip.address }}
                  </button>
                </li>
              }
            </ul>
          }
        </article>

        <!-- Sistema -->
        <article class="rounded-xl border border-white/5 bg-[#16161a] p-5">
          <h2 class="text-base font-semibold text-white">Sistema</h2>
          <p class="mt-1 text-sm text-zinc-500">Ferramentas e manutenção rápida.</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-white/10 bg-[#121218] px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              [disabled]="quick.loading()"
              (click)="restartExplorer()"
            >
              Reiniciar Explorer
            </button>
            @for (tool of systemTools; track tool.id) {
              <button
                type="button"
                class="rounded-lg border border-white/10 bg-[#121218] px-3 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:text-white disabled:opacity-50"
                [disabled]="quick.loading()"
                (click)="openTool(tool.id)"
                [title]="tool.description"
              >
                {{ tool.label }}
              </button>
            }
          </div>
        </article>
      </div>
    </section>
  `,
})
export class QuickAccessPageComponent {
  protected readonly quick = inject(QuickAccessService);
  protected readonly folders = FOLDERS;
  protected readonly systemTools = SYSTEM_TOOLS;
  protected portInput = 4200;

  onKillPort(): void {
    this.quick.clearFeedback();
    void this.quick.killPort(Number(this.portInput));
  }

  onInspectPort(): void {
    this.quick.clearFeedback();
    void this.quick.inspectPort(Number(this.portInput));
  }

  openFolder(id: string): void {
    this.quick.clearFeedback();
    void this.quick.openFolder(id);
  }

  flushDns(): void {
    this.quick.clearFeedback();
    void this.quick.flushDns();
  }

  loadIps(): void {
    this.quick.clearFeedback();
    void this.quick.loadLocalIps();
  }

  copyIps(): void {
    this.quick.clearFeedback();
    void this.quick.copyLocalIps();
  }

  copyIp(address: string): void {
    this.quick.clearFeedback();
    void this.quick.copyText(address);
  }

  restartExplorer(): void {
    this.quick.clearFeedback();
    void this.quick.restartExplorer();
  }

  openTool(id: string): void {
    this.quick.clearFeedback();
    void this.quick.openSystemTool(id);
  }
}
