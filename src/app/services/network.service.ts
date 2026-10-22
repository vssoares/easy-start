import { Injectable, signal } from '@angular/core';
import { invoke, isDesktop } from '../core/desktop';
import { LocalIpInfo } from '../models/quick-access.model';

export type StepId = 'gateway' | 'internet' | 'dns' | 'download' | 'upload';
export type StepState = 'idle' | 'running' | 'done' | 'failed';

export interface PingResult {
  available: boolean;
  message?: string;
  name?: string;
  address?: string;
  sent?: number;
  min?: number;
  avg?: number;
  max?: number;
  jitter?: number;
  lossPercent?: number;
  answered?: boolean;
}

interface DnsResult {
  times: { host: string; ms: number | null }[];
  avgMs: number | null;
  failed: number;
}

interface SpeedResult {
  mbps: number | null;
}

export interface Step {
  id: StepId;
  label: string;
  hint: string;
  state: StepState;
  /** Resumo em uma linha, mostrado quando termina. */
  text: string;
  /** Nota de 'ok' | 'warn' | 'bad' para colorir o resultado. */
  level: 'ok' | 'warn' | 'bad' | 'none';
}

const INITIAL_STEPS = (): Step[] => [
  { id: 'gateway', label: 'Roteador', hint: 'Latência e perda até o seu roteador (Wi-Fi/cabo)', state: 'idle', text: '', level: 'none' },
  { id: 'internet', label: 'Internet', hint: 'Latência e perda até a internet (Cloudflare)', state: 'idle', text: '', level: 'none' },
  { id: 'dns', label: 'DNS', hint: 'Tempo para resolver nomes de sites', state: 'idle', text: '', level: 'none' },
  { id: 'download', label: 'Download', hint: 'Velocidade de download (≈6 s)', state: 'idle', text: '', level: 'none' },
  { id: 'upload', label: 'Upload', hint: 'Velocidade de upload (≈6 s)', state: 'idle', text: '', level: 'none' },
];

@Injectable({ providedIn: 'root' })
export class NetworkService {
  readonly steps = signal<Step[]>(INITIAL_STEPS());
  readonly running = signal(false);
  readonly ips = signal<LocalIpInfo[]>([]);
  readonly message = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  async loadIps(): Promise<void> {
    if (!this.available()) return;
    try {
      this.ips.set(await invoke<LocalIpInfo[]>('list_local_ips'));
    } catch (err) {
      this.error.set(this.format(err));
    }
  }

  async flushDns(): Promise<void> {
    if (!this.available()) return;
    this.message.set(null);
    this.error.set(null);
    try {
      const result = await invoke<{ message: string }>('flush_dns');
      this.message.set(result.message.split('\n')[0] || result.message);
    } catch (err) {
      this.error.set(this.format(err));
    }
  }

  async runAll(): Promise<void> {
    if (!this.available() || this.running()) return;

    this.running.set(true);
    this.message.set(null);
    this.error.set(null);
    this.steps.set(INITIAL_STEPS());

    try {
      await this.step('gateway', async () => this.fromPing(await invoke<PingResult>('net_gateway_ping')));
      await this.step('internet', async () => this.fromPing(await invoke<PingResult>('net_internet_ping')));
      await this.step('dns', async () => {
        const dns = await invoke<DnsResult>('net_dns');
        if (dns.avgMs === null) return { text: 'Falha ao resolver nomes. Verifique o DNS.', level: 'bad' as const };
        const failed = dns.failed ? ` · ${dns.failed} falha(s)` : '';
        return { text: `média ${dns.avgMs} ms${failed}`, level: dns.failed ? ('warn' as const) : this.level(dns.avgMs, 60, 150) };
      });
      await this.step('download', async () => this.fromSpeed(await invoke<SpeedResult>('net_speed', { direction: 'download' })));
      await this.step('upload', async () => this.fromSpeed(await invoke<SpeedResult>('net_speed', { direction: 'upload' })));
    } finally {
      this.running.set(false);
    }
  }

  private async step(id: StepId, action: () => Promise<{ text: string; level: Step['level'] }>): Promise<void> {
    this.patch(id, { state: 'running', text: '', level: 'none' });
    try {
      const { text, level } = await action();
      this.patch(id, { state: 'done', text, level });
    } catch (err) {
      this.patch(id, { state: 'failed', text: this.format(err), level: 'bad' });
    }
  }

  private fromPing(r: PingResult): { text: string; level: Step['level'] } {
    if (!r.available) return { text: r.message ?? 'Indisponível.', level: 'warn' };
    if (!r.answered) return { text: `${r.address}: não responde`, level: 'bad' };

    const text = `${r.address} · média ${r.avg} ms · mín ${r.min} · máx ${r.max} · jitter ${r.jitter} ms · perda ${r.lossPercent}%`;
    const lossBad = (r.lossPercent ?? 0) >= 2;
    const level = lossBad || (r.jitter ?? 0) > 30 ? 'bad' : this.level(r.avg ?? 0, r.name === 'Roteador' ? 10 : 50, r.name === 'Roteador' ? 30 : 120);
    return { text, level };
  }

  private fromSpeed(r: SpeedResult): { text: string; level: Step['level'] } {
    return r.mbps === null ? { text: 'Não foi possível medir.', level: 'bad' } : { text: `${r.mbps} Mbps`, level: 'none' };
  }

  private level(value: number, good: number, bad: number): Step['level'] {
    return value <= good ? 'ok' : value <= bad ? 'warn' : 'bad';
  }

  private patch(id: StepId, change: Partial<Step>): void {
    this.steps.update((steps) => steps.map((s) => (s.id === id ? { ...s, ...change } : s)));
  }

  private available(): boolean {
    if (isDesktop()) return true;
    this.error.set('Disponível apenas no app desktop (Electron).');
    return false;
  }

  private format(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }
}
