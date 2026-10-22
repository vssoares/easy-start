import { shell, WebContents } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { requireWindows, runPowerShell } from '../exec';
import { registerAll } from '../registry';

type Vendor = 'nvidia' | 'amd' | 'intel' | 'other';

interface GpuDriverRequest {
  name: string;
  driverVersion: string;
  vendor: Vendor;
  studio?: boolean;
}

interface GpuDriverStatus {
  vendor: Vendor;
  gpuName: string;
  installed: string;
  latest: string;
  downloadUrl: string;
  sizeText: string;
  officialPage: string;
  message: string;
  canAutoInstall: boolean;
  updateAvailable: boolean;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) EasyStart';
const DOWNLOAD_DIR = path.join(os.tmpdir(), 'EasyStart', 'drivers');

/** Hosts dos quais aceitamos baixar instaladores de driver. */
const TRUSTED_HOSTS: Record<'nvidia' | 'amd', RegExp> = {
  nvidia: /(^|\.)download\.nvidia\.com$/i,
  amd: /(^|\.)drivers\.amd\.com$/i,
};

const SIGNER: Record<'nvidia' | 'amd', string> = {
  nvidia: 'NVIDIA',
  amd: 'Advanced Micro Devices',
};

const OFFICIAL_PAGE: Record<Vendor, string> = {
  nvidia: 'https://www.nvidia.com/Download/index.aspx',
  amd: 'https://www.amd.com/en/support/download/drivers.html',
  intel: 'https://www.intel.com/content/www/us/en/download-center/home.html',
  other: '',
};

let installing = false;

// ---- Utilitários ----

async function getText(url: string, referer?: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...(referer ? { Referer: referer } : {}) },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.text();
}

/** "32.0.15.4601" (versão do WMI da NVIDIA) vira "546.01". */
export function nvidiaFriendlyVersion(wmiVersion: string): string {
  const parts = wmiVersion.split('.');
  if (parts.length !== 4) return wmiVersion;

  const digits = parts[2] + parts[3];
  if (digits.length < 5) return wmiVersion;

  const last = digits.slice(-5);
  return `${last.slice(0, 3)}.${last.slice(3)}`;
}

const compareVersions = (a: string, b: string): number => (Number.parseFloat(a) || 0) - (Number.parseFloat(b) || 0);

function baseStatus(gpu: GpuDriverRequest): GpuDriverStatus {
  return {
    vendor: gpu.vendor,
    gpuName: gpu.name,
    installed: gpu.vendor === 'nvidia' ? nvidiaFriendlyVersion(gpu.driverVersion) : gpu.driverVersion,
    latest: '',
    downloadUrl: '',
    sizeText: '',
    officialPage: OFFICIAL_PAGE[gpu.vendor],
    message: '',
    canAutoInstall: false,
    updateAvailable: false,
  };
}

// ---- NVIDIA ----

function lookupValues(xml: string): { name: string; value: string }[] {
  const entries: { name: string; value: string }[] = [];
  for (const block of xml.matchAll(/<LookupValue\b[^>]*>([\s\S]*?)<\/LookupValue>/gi)) {
    const name = block[1].match(/<Name>([\s\S]*?)<\/Name>/i)?.[1];
    const value = block[1].match(/<Value>([\s\S]*?)<\/Value>/i)?.[1];
    if (name !== undefined && value !== undefined) {
      entries.push({ name: name.trim(), value: value.trim() });
    }
  }
  return entries;
}

/** Descobre os códigos de série (psid) e produto (pfid) da placa na base de drivers da NVIDIA. */
async function resolveNvidiaIds(gpuName: string): Promise<{ psid: number; pfid: number }> {
  const mobile = /Laptop|Max-Q|Mobile|Notebook/i.test(gpuName);
  const match = gpuName.match(/(RTX|GTX|GT)\s*(\d{3,4})/i);
  if (!match) {
    throw new Error(`Modelo de placa não reconhecido: ${gpuName}`);
  }

  const prefix = match[1].toUpperCase();
  const n = Number(match[2]);
  const hundreds = Math.floor(n / 100);

  let series: string;
  if (prefix === 'RTX') series = `RTX ${hundreds} Series`;
  else if (n >= 1600 && n < 1700) series = '16 Series';
  else if (n >= 1000 && n < 1100) series = '10 Series';
  else if (n >= 900 && n < 1000) series = '900 Series';
  else if (n >= 700 && n < 800) series = '700 Series';
  else series = `${hundreds * 100} Series`;

  const seriesList = lookupValues(
    await getText('https://www.nvidia.com/Download/API/lookupValueSearch.aspx?TypeID=2&ParentID=1'),
  );
  const candidates = seriesList
    .filter(
      (s) =>
        s.name.toLowerCase().includes(series.toLowerCase()) &&
        s.name.toLowerCase().includes('notebook') === mobile,
    )
    .sort((a, b) => a.name.length - b.name.length);
  if (candidates.length === 0) {
    throw new Error(`Série da placa não encontrada na NVIDIA (${series}).`);
  }
  const psid = Number(candidates[0].value);

  const products = lookupValues(
    await getText(`https://www.nvidia.com/Download/API/lookupValueSearch.aspx?TypeID=3&ParentID=${psid}`),
  );
  if (products.length === 0) {
    throw new Error('Nenhum produto listado para a série.');
  }

  const key = gpuName.replace(/^NVIDIA\s+/i, '').replace('Laptop GPU', '').trim().toLowerCase();
  // O driver é unificado por série: qualquer produto da série devolve o mesmo instalador.
  const pick =
    products.find((p) => p.name.toLowerCase() === key) ??
    products.find((p) => p.name.toLowerCase().includes(match[0].toLowerCase())) ??
    products[0];

  return { psid, pfid: Number(pick.value) };
}

function findDriverFields(node: unknown, found: { ver?: string; url?: string; size?: string } = {}) {
  if (Array.isArray(node)) {
    node.forEach((item) => findDriverFields(item, found));
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        if (key === 'Version' && !found.ver) found.ver = value;
        else if (key === 'DownloadURL' && !found.url) found.url = value;
        else if (key === 'DownloadURLFileSize' && !found.size) found.size = value;
      } else {
        findDriverFields(value, found);
      }
    }
  }
  return found;
}

async function checkNvidia(status: GpuDriverStatus, studio: boolean): Promise<void> {
  const { psid, pfid } = await resolveNvidiaIds(status.gpuName);
  const url =
    'https://gfwsl.geforce.com/services_toolkit/services/com/nvidia/services/AjaxDriverService.php' +
    `?func=DriverManualLookup&psid=${psid}&pfid=${pfid}&osID=57&languageCode=1033&beta=0&isWHQL=1&dch=1` +
    `&upCRD=${studio ? 1 : 0}&qnf=0&sort1=1&numberOfResults=1`;

  const { ver, url: download, size } = findDriverFields(JSON.parse(await getText(url)));
  if (!ver || !download) {
    status.message = 'A NVIDIA não devolveu um driver para esta placa. Use a página oficial.';
    return;
  }

  status.latest = ver.trim();
  status.downloadUrl = download.replace(/^http:\/\//i, 'https://');
  status.sizeText = size ?? '';
  status.canAutoInstall = true;
  status.updateAvailable = !!status.installed && compareVersions(status.latest, status.installed) > 0;
  status.message = status.updateAvailable
    ? `Há um driver mais novo: ${status.latest} (instalado: ${status.installed}).`
    : `Você já está com o mais recente (${status.installed}).`;
}

// ---- AMD ----

/**
 * A AMD não tem API de versão: procura o link do instalador na página oficial do modelo.
 * Se o site mudar ou bloquear, o usuário cai na página oficial.
 */
async function checkAmd(status: GpuDriverStatus): Promise<void> {
  const match = status.gpuName.match(/RX\s*(\d{4})\s*(XTX|XT|GRE|M)?/i);
  if (!match) {
    status.message = 'AMD: modelo não reconhecido para consulta automática. Use a página oficial.';
    return;
  }

  const n = Number(match[1]);
  const family = `radeon-rx-${Math.floor(n / 1000)}000-series`;
  const suffix = match[2] ? `-${match[2].toLowerCase()}` : '';
  const page = `https://www.amd.com/en/support/downloads/drivers.html/graphics/radeon-rx/${family}/amd-radeon-rx-${n}${suffix}.html`;
  status.officialPage = page;

  const html = await getText(page, 'https://www.amd.com/');
  const link =
    html.match(/https:\/\/drivers\.amd\.com\/drivers\/[^"'\s<>\\]*win11[^"'\s<>\\]*\.exe/i) ??
    html.match(/https:\/\/drivers\.amd\.com\/drivers\/[^"'\s<>\\]*\.exe/i);
  if (!link) {
    status.message = 'AMD: o site não devolveu o link do instalador (pode estar protegido). Abra a página oficial do seu modelo.';
    return;
  }

  status.downloadUrl = link[0];
  status.latest = link[0].match(/edition-([\d.]+)/i)?.[1] ?? path.basename(link[0], '.exe');
  status.canAutoInstall = true;
  status.message = `AMD Software Adrenalin ${status.latest} disponível para o seu modelo. Compare com a versão do AMD Software (o Windows mostra ${status.installed}).`;
}

async function checkGpuDriver(gpu: GpuDriverRequest): Promise<GpuDriverStatus> {
  const status = baseStatus(gpu);

  try {
    if (gpu.vendor === 'nvidia') await checkNvidia(status, !!gpu.studio);
    else if (gpu.vendor === 'amd') await checkAmd(status);
    else status.message = 'Este fabricante não tem download direto. Use a página oficial.';
  } catch (error) {
    status.message = `Não foi possível consultar o fabricante: ${(error as Error).message}`;
  }

  return status;
}

// ---- Download e instalação ----

function progressSender(sender: WebContents) {
  let last = 0;
  return (message: string, percent: number, force = false) => {
    const now = Date.now();
    if (!force && now - last < 200) return;
    last = now;
    if (!sender.isDestroyed()) {
      sender.send('driver-progress', { message, percent });
    }
  };
}

async function download(
  url: string,
  file: string,
  referer: string | undefined,
  report: ReturnType<typeof progressSender>,
): Promise<void> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, ...(referer ? { Referer: referer } : {}) },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Falha no download (HTTP ${response.status}).`);
  }

  const total = Number(response.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(file);
  const started = Date.now();
  let done = 0;

  try {
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      if (!out.write(chunk)) {
        await new Promise<void>((resolve) => out.once('drain', resolve));
      }
      done += chunk.length;

      const mb = done / 1048576;
      const speed = mb / Math.max(0.1, (Date.now() - started) / 1000);
      report(
        `Baixando… ${mb.toFixed(0)} de ${total ? (total / 1048576).toFixed(0) : '?'} MB · ${speed.toFixed(1)} MB/s`,
        total ? Math.round((done / total) * 100) : 0,
      );
    }
  } finally {
    await new Promise<void>((resolve) => out.end(resolve));
  }
}

/** Confere a assinatura digital (Authenticode) e o fabricante do instalador. */
async function verifySignature(file: string, signer: string): Promise<void> {
  const escaped = file.replace(/'/g, "''");
  const result = await runPowerShell(
    `$s = Get-AuthenticodeSignature -LiteralPath '${escaped}'; ` +
      `[Console]::Out.Write(($s.Status.ToString() + '|' + $s.SignerCertificate.Subject))`,
  );

  const [status, subject = ''] = result.stdout.trim().split('|');
  if (status !== 'Valid') {
    await fs.promises.rm(file, { force: true });
    throw new Error(`Assinatura digital inválida (${status || 'desconhecida'}). O arquivo foi descartado.`);
  }
  if (!subject.toLowerCase().includes(signer.toLowerCase())) {
    await fs.promises.rm(file, { force: true });
    throw new Error(`O arquivo está assinado por outro fabricante (${subject}). Foi descartado.`);
  }
}

async function tryRestorePoint(): Promise<string> {
  const result = await runPowerShell(
    "Checkpoint-Computer -Description 'Easy Start - antes do driver' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop",
  );
  return result.code === 0
    ? 'Ponto de restauração criado.'
    : 'Ponto de restauração não criado (proteção do sistema desligada, já criado hoje ou sem permissão de administrador).';
}

async function installGpuDriver(gpu: GpuDriverRequest, sender: WebContents): Promise<string> {
  if (installing) {
    throw new Error('Já existe um download de driver em andamento.');
  }
  if (gpu.vendor !== 'nvidia' && gpu.vendor !== 'amd') {
    throw new Error('Este fabricante não tem download direto.');
  }

  installing = true;
  const report = progressSender(sender);

  try {
    // A URL é resolvida de novo aqui: nunca confiamos em um link vindo do renderer.
    report('Consultando o fabricante…', 0, true);
    const status = await checkGpuDriver(gpu);
    if (!status.canAutoInstall || !status.downloadUrl) {
      throw new Error(status.message || 'Nenhum instalador encontrado.');
    }

    const url = new URL(status.downloadUrl);
    if (url.protocol !== 'https:' || !TRUSTED_HOSTS[gpu.vendor].test(url.hostname)) {
      throw new Error(`Origem do download não confiável: ${url.hostname}`);
    }

    await fs.promises.mkdir(DOWNLOAD_DIR, { recursive: true });
    const file = path.join(DOWNLOAD_DIR, path.basename(url.pathname));

    report('Baixando o driver…', 0, true);
    await download(status.downloadUrl, file, gpu.vendor === 'amd' ? 'https://www.amd.com/' : undefined, report);

    report('Conferindo a assinatura digital…', 100, true);
    await verifySignature(file, SIGNER[gpu.vendor]);

    report('Criando ponto de restauração (se o Windows permitir)…', 100, true);
    const restore = await tryRestorePoint();

    const error = await shell.openPath(file);
    if (error) {
      throw new Error(`Não foi possível abrir o instalador: ${error}`);
    }

    return `Instalador ${status.latest} aberto (assinatura ${gpu.vendor.toUpperCase()} válida). ${restore} Siga o instalador; a tela pode piscar durante a instalação.`;
  } finally {
    installing = false;
  }
}

registerAll({
  check_gpu_driver: ({ gpu }: { gpu: GpuDriverRequest }) => {
    requireWindows();
    return checkGpuDriver(gpu);
  },

  install_gpu_driver: ({ gpu }: { gpu: GpuDriverRequest }, { sender }) => {
    requireWindows();
    return installGpuDriver(gpu, sender);
  },
});
