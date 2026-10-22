import dns from 'node:dns/promises';
import { requireWindows } from '../exec';
import { asArray, psJson, psQuote } from '../ps';
import { registerAll } from '../registry';

const SPEED_HOST = 'https://speed.cloudflare.com';
const INTERNET_TARGET = '1.1.1.1';
const DNS_SAMPLES = ['google.com', 'cloudflare.com', 'microsoft.com'];
const SPEED_SECONDS = 6;
const PING_COUNT = 20;

interface PingStat {
  name: string;
  address: string;
  sent: number;
  lost: number;
  min: number;
  avg: number;
  max: number;
  jitter: number;
  lossPercent: number;
  answered: boolean;
}

function stat(name: string, address: string, rtts: number[], sent: number): PingStat {
  if (rtts.length === 0) {
    return { name, address, sent, lost: sent, min: 0, avg: 0, max: 0, jitter: 0, lossPercent: 100, answered: false };
  }

  let jitter = 0;
  for (let i = 1; i < rtts.length; i++) jitter += Math.abs(rtts[i] - rtts[i - 1]);
  jitter = rtts.length > 1 ? jitter / (rtts.length - 1) : 0;

  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    name,
    address,
    sent,
    lost: sent - rtts.length,
    min: round(Math.min(...rtts)),
    avg: round(rtts.reduce((a, b) => a + b, 0) / rtts.length),
    max: round(Math.max(...rtts)),
    jitter: round(jitter),
    lossPercent: round((100 * (sent - rtts.length)) / sent),
    answered: true,
  };
}

async function defaultGateway(): Promise<string | null> {
  const gateway = await psJson<string | null>(`
$route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Where-Object { $_.NextHop -ne '0.0.0.0' } | Sort-Object RouteMetric | Select-Object -First 1
ConvertTo-Json -InputObject $(if ($route) { [string]$route.NextHop } else { $null })`);
  return gateway || null;
}

async function pingHost(name: string, address: string): Promise<PingStat> {
  if (!/^[\w.:-]+$/.test(address)) throw new Error('Endereço inválido.');

  const rtts = asArray(
    await psJson<number[] | number | null>(`
$ping = New-Object System.Net.NetworkInformation.Ping
$rtts = New-Object System.Collections.ArrayList
for ($i = 0; $i -lt ${PING_COUNT}; $i++) {
  try {
    $reply = $ping.Send(${psQuote(address)}, 1500)
    if ($reply.Status -eq 'Success') { [void]$rtts.Add([Math]::Max(1, [double]$reply.RoundtripTime)) }
  } catch {}
  Start-Sleep -Milliseconds 200
}
ConvertTo-Json -InputObject @($rtts) -Compress`),
  );
  return stat(name, address, rtts, PING_COUNT);
}

/** Lê o corpo da resposta e conta bytes por tempo fixo; devolve Mbps. */
async function measureDownload(): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SPEED_SECONDS * 1000);
  const started = performance.now();
  let total = 0;

  try {
    while (performance.now() - started < SPEED_SECONDS * 1000) {
      const response = await fetch(`${SPEED_HOST}/__down?bytes=25000000`, { signal: controller.signal });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

      const reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
      }
    }
  } catch (error) {
    // O corte por tempo é o fim normal do teste; outros erros só valem se nada foi medido.
    if (!(error instanceof Error && error.name === 'AbortError') && total === 0) throw error;
  } finally {
    clearTimeout(timer);
  }

  const seconds = (performance.now() - started) / 1000;
  return total > 0 && seconds > 0 ? Math.round(((total * 8) / seconds / 1e6) * 10) / 10 : null;
}

async function measureUpload(): Promise<number | null> {
  const chunk = new Uint8Array(4_000_000);
  const started = performance.now();
  let total = 0;

  while (performance.now() - started < SPEED_SECONDS * 1000) {
    const response = await fetch(`${SPEED_HOST}/__up`, {
      method: 'POST',
      body: chunk,
      signal: AbortSignal.timeout(SPEED_SECONDS * 1000 + 5000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    total += chunk.byteLength;
  }

  const seconds = (performance.now() - started) / 1000;
  return total > 0 ? Math.round(((total * 8) / seconds / 1e6) * 10) / 10 : null;
}

registerAll({
  async net_gateway_ping() {
    requireWindows();
    const gateway = await defaultGateway();
    if (!gateway) return { available: false as const, message: 'Roteador não encontrado (sem rota padrão).' };
    return { available: true as const, ...(await pingHost('Roteador', gateway)) };
  },

  async net_internet_ping() {
    requireWindows();
    return { available: true as const, ...(await pingHost('Internet (Cloudflare)', INTERNET_TARGET)) };
  },

  /** Tempo de resolução de nomes, medido sem cache do app (o do Windows pode responder). */
  async net_dns() {
    const times: { host: string; ms: number | null }[] = [];

    for (const host of DNS_SAMPLES) {
      const started = performance.now();
      try {
        await dns.lookup(host);
        times.push({ host, ms: Math.round(performance.now() - started) });
      } catch {
        times.push({ host, ms: null });
      }
    }

    const ok = times.filter((t): t is { host: string; ms: number } => t.ms !== null);
    return {
      times,
      avgMs: ok.length ? Math.round(ok.reduce((sum, t) => sum + t.ms, 0) / ok.length) : null,
      failed: times.length - ok.length,
    };
  },

  async net_speed({ direction }: { direction: 'download' | 'upload' }) {
    if (direction !== 'download' && direction !== 'upload') throw new Error('Direção inválida.');
    const mbps = direction === 'download' ? await measureDownload() : await measureUpload();
    return { direction, mbps };
  },
});
