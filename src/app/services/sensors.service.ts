import { computed, Injectable, signal } from '@angular/core';
import { invoke, isDesktop } from '../core/desktop';
import { BottleneckVerdict, GpuDetails, Limiter, SensorSnapshot } from '../models/sensors.model';

const POLL_MS = 1000;
const HISTORY_SIZE = 60;

const VERDICTS: Record<Limiter, { title: string; advice: string }> = {
  gpu: {
    title: 'GPU no limite',
    advice:
      'Normal em jogos pesados: a placa de vídeo está sendo bem aproveitada. Para mais FPS, reduza resolução ou qualidade gráfica, ou ative DLSS/FSR.',
  },
  cpu: {
    title: 'Gargalo de CPU',
    advice:
      'A CPU (ou um núcleo dela) não acompanha a GPU. Subir resolução/gráficos quase não custa FPS. Para ganhar FPS: reduza opções que pesam na CPU (distância de visão, multidões, física), feche programas em segundo plano e confira se o XMP/EXPO da RAM está ativo na BIOS.',
  },
  vram: {
    title: 'Memória de vídeo cheia',
    advice: 'A memória da placa de vídeo encheu, o que causa travadas. Reduza a qualidade das texturas ou a resolução.',
  },
  ram: {
    title: 'Memória RAM cheia',
    advice:
      'A RAM está quase cheia e o Windows passa a usar o disco. Feche programas em segundo plano ou use a limpeza de memória em Ferramentas.',
  },
  thermal: {
    title: 'Limitado por temperatura',
    advice: 'Algum componente está reduzindo o clock por calor. Verifique ventoinhas, fluxo de ar e pasta térmica.',
  },
  capped: {
    title: 'Nada no limite',
    advice: 'Nenhum componente está no limite agora: trava de FPS, V-Sync ou o jogo está em um menu.',
  },
};

@Injectable({ providedIn: 'root' })
export class SensorsService {
  readonly snapshot = signal<SensorSnapshot | null>(null);
  readonly details = signal<GpuDetails | null>(null);
  readonly error = signal<string | null>(null);
  readonly running = signal(false);

  /** Últimas leituras (1/s) para os gráficos. */
  readonly cpuHistory = signal<number[]>([]);
  readonly gpuHistory = signal<number[]>([]);

  /**
   * Regras (na ordem): VRAM cheia → térmico → GPU ≥ 90% (normal em jogo pesado) →
   * CPU/núcleo ≥ 85% com GPU sobrando → RAM cheia → nada no limite.
   */
  readonly verdict = computed<BottleneckVerdict | null>(() => {
    const s = this.snapshot();
    if (!s) return null;

    let limiter: Limiter = 'capped';
    if ((s.gpu.vramPercent ?? 0) >= 97) limiter = 'vram';
    else if (s.gpu.thermalThrottle || (s.cpu.temperature ?? 0) >= 95) limiter = 'thermal';
    else if ((s.gpu.load ?? 0) >= 90) limiter = 'gpu';
    else if ((s.cpu.busiestCore ?? 0) >= 85 || (s.cpu.load ?? 0) >= 85) limiter = 'cpu';
    else if (s.ram.percent >= 92) limiter = 'ram';

    return { limiter, ...VERDICTS[limiter] };
  });

  private timer: ReturnType<typeof setTimeout> | null = null;

  start(): void {
    if (this.running()) return;
    if (!isDesktop()) {
      this.error.set('Disponível apenas no app desktop (Electron).');
      return;
    }

    this.running.set(true);
    this.error.set(null);
    void this.loadDetails();
    void this.tick();
  }

  stop(): void {
    this.running.set(false);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (!this.running()) return;

    try {
      const snap = await invoke<SensorSnapshot>('sensor_snapshot');
      this.snapshot.set(snap);
      this.error.set(null);
      this.cpuHistory.update((h) => [...h, snap.cpu.load ?? 0].slice(-HISTORY_SIZE));
      this.gpuHistory.update((h) => [...h, snap.gpu.load ?? 0].slice(-HISTORY_SIZE));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }

    // A próxima leitura só é agendada depois desta terminar, para as chamadas nunca se acumularem.
    if (this.running()) this.timer = setTimeout(() => void this.tick(), POLL_MS);
  }

  private async loadDetails(): Promise<void> {
    if (this.details()) return;
    try {
      this.details.set(await invoke<GpuDetails>('gpu_details'));
    } catch (err) {
      this.details.set({ available: false, message: err instanceof Error ? err.message : String(err) });
    }
  }
}
