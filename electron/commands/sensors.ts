import fs from 'node:fs';
import os from 'node:os';
import { requireWindows, run } from '../exec';
import { psJson } from '../ps';
import { registerAll } from '../registry';

const NVIDIA_SMI_CANDIDATES = [
  'nvidia-smi',
  'C:\\Windows\\System32\\nvidia-smi.exe',
  'C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe',
];

const EXTRAS_MAX_AGE_MS = 3000;

interface CpuTimes {
  idle: number;
  total: number;
}

let previousCpu: CpuTimes[] | null = null;
let nvidiaSmi: string | null | undefined;

// ---- CPU / RAM (nativo do Node, sem custo) ----

function readCpuTimes(): CpuTimes[] {
  return os.cpus().map(({ times }) => ({
    idle: times.idle,
    total: times.user + times.nice + times.sys + times.idle + times.irq,
  }));
}

function cpuLoad(): { total: number | null; busiestCore: number | null; busiestIndex: number | null; perCore: number[] } {
  const current = readCpuTimes();
  const previous = previousCpu;
  previousCpu = current;
  if (!previous || previous.length !== current.length) {
    return { total: null, busiestCore: null, busiestIndex: null, perCore: [] };
  }

  const perCore = current.map((now, index) => {
    const totalDelta = now.total - previous[index].total;
    const idleDelta = now.idle - previous[index].idle;
    return totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 1000) / 10 : 0;
  });

  const total = perCore.reduce((sum, value) => sum + value, 0) / perCore.length;
  const busiestCore = Math.max(...perCore);
  return {
    total: Math.round(total * 10) / 10,
    busiestCore,
    busiestIndex: perCore.indexOf(busiestCore),
    perCore,
  };
}

// ---- NVIDIA (nvidia-smi) ----

async function findNvidiaSmi(): Promise<string | null> {
  if (nvidiaSmi !== undefined) return nvidiaSmi;

  for (const candidate of NVIDIA_SMI_CANDIDATES) {
    if (candidate.includes('\\') && !fs.existsSync(candidate)) continue;
    const result = await run(candidate, ['-L']);
    if (result.code === 0 && !result.spawnError) {
      nvidiaSmi = candidate;
      return candidate;
    }
  }
  nvidiaSmi = null;
  return null;
}

const num = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
};

interface NvidiaReading {
  name: string;
  load: number | null;
  temperature: number | null;
  coreClockMhz: number | null;
  memoryClockMhz: number | null;
  powerWatts: number | null;
  powerLimitWatts: number | null;
  fanPercent: number | null;
  vramUsedMb: number | null;
  vramTotalMb: number | null;
  thermalThrottle: boolean;
}

async function queryNvidia(): Promise<NvidiaReading | null> {
  const exe = await findNvidiaSmi();
  if (!exe) return null;

  const fields = [
    'name', 'utilization.gpu', 'temperature.gpu', 'clocks.gr', 'clocks.mem', 'power.draw', 'power.limit',
    'fan.speed', 'memory.used', 'memory.total',
  ];
  const withThrottle = [...fields, 'clocks_throttle_reasons.active'];

  let result = await run(exe, [`--query-gpu=${withThrottle.join(',')}`, '--format=csv,noheader,nounits', '-i', '0']);
  let hasThrottle = true;
  if (result.code !== 0) {
    // Drivers que renomearam o campo de limitação: tenta sem ele.
    result = await run(exe, [`--query-gpu=${fields.join(',')}`, '--format=csv,noheader,nounits', '-i', '0']);
    hasThrottle = false;
  }
  if (result.code !== 0) return null;

  const cols = result.stdout.trim().split(/\r?\n/)[0]?.split(',').map((c) => c.trim());
  if (!cols || cols.length < fields.length) return null;

  const reasons = hasThrottle ? Number.parseInt(cols[10] ?? '0', 16) : 0;
  return {
    name: cols[0],
    load: num(cols[1]),
    temperature: num(cols[2]),
    coreClockMhz: num(cols[3]),
    memoryClockMhz: num(cols[4]),
    powerWatts: num(cols[5]),
    powerLimitWatts: num(cols[6]),
    fanPercent: num(cols[7]),
    vramUsedMb: num(cols[8]),
    vramTotalMb: num(cols[9]),
    // Bits 0x20 (SW thermal slowdown) e 0x40 (HW thermal slowdown).
    thermalThrottle: Number.isFinite(reasons) && (reasons & 0x60) !== 0,
  };
}

// ---- Leituras mais caras (contadores do Windows), em cache ----

interface Extras {
  cpuTemperature: number | null;
  gpuLoad: number | null;
  gpuVramUsedMb: number | null;
}

let extras: Extras = { cpuTemperature: null, gpuLoad: null, gpuVramUsedMb: null };
let extrasAt = 0;
let extrasInFlight = false;

/** Atualiza em segundo plano: a chamada de sensores nunca espera por isto. */
function refreshExtras(): void {
  if (extrasInFlight || Date.now() - extrasAt < EXTRAS_MAX_AGE_MS) return;
  extrasInFlight = true;

  void psJson<Extras>(`
$ErrorActionPreference = 'SilentlyContinue'
$temp = $null
$zones = @(Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature)
if ($zones.Count -gt 0) { $temp = [Math]::Round((($zones | Measure-Object CurrentTemperature -Maximum).Maximum / 10) - 273.15, 1) }
$engines = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -like '*engtype_3D*' })
$load = $null
if ($engines.Count -gt 0) { $load = [Math]::Min(100, ($engines | Measure-Object UtilizationPercentage -Sum).Sum) }
$mem = @(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory)
$used = $null
if ($mem.Count -gt 0) { $used = [Math]::Round((($mem | Measure-Object DedicatedUsage -Sum).Sum) / 1MB, 0) }
[PSCustomObject]@{ cpuTemperature = $temp; gpuLoad = $load; gpuVramUsedMb = $used } | ConvertTo-Json -Compress`)
    .then((value) => {
      if (value) extras = value;
    })
    .catch(() => undefined)
    .finally(() => {
      extrasAt = Date.now();
      extrasInFlight = false;
    });
}

registerAll({
  /** Uma leitura (chamada 1x/s pela interface) de tudo que pode limitar o desempenho. */
  async sensor_snapshot() {
    requireWindows();
    refreshExtras();

    const cpu = cpuLoad();
    const totalMem = os.totalmem();
    const usedMem = totalMem - os.freemem();
    const nvidia = await queryNvidia();

    // Sem NVIDIA: usa os contadores genéricos do Windows (uso do 3D e VRAM dedicada em uso).
    const gpu = nvidia ?? {
      name: null,
      load: extras.gpuLoad,
      temperature: null,
      coreClockMhz: null,
      memoryClockMhz: null,
      powerWatts: null,
      powerLimitWatts: null,
      fanPercent: null,
      vramUsedMb: extras.gpuVramUsedMb,
      vramTotalMb: null,
      thermalThrottle: false,
    };

    return {
      at: Date.now(),
      cpu: {
        name: os.cpus()[0]?.model.trim() ?? '',
        load: cpu.total,
        busiestCore: cpu.busiestCore,
        busiestCoreIndex: cpu.busiestIndex,
        temperature: extras.cpuTemperature,
        clockMhz: os.cpus()[0]?.speed ?? null,
        perCore: cpu.perCore,
      },
      ram: {
        usedMb: Math.round(usedMem / 1048576),
        totalMb: Math.round(totalMem / 1048576),
        percent: Math.round((usedMem / totalMem) * 1000) / 10,
      },
      gpu: {
        ...gpu,
        vramPercent:
          gpu.vramUsedMb !== null && gpu.vramTotalMb ? Math.round((gpu.vramUsedMb / gpu.vramTotalMb) * 1000) / 10 : null,
      },
      sources: {
        gpu: nvidia ? 'nvidia-smi' : extras.gpuLoad !== null ? 'contadores do Windows' : 'indisponível',
        cpuTemperature: extras.cpuTemperature !== null ? 'ACPI' : 'indisponível',
      },
    };
  },

  /** Dados fixos da GPU principal (PCIe, VBIOS, limites), no estilo GPU-Z. NVIDIA via nvidia-smi. */
  async gpu_details() {
    requireWindows();
    const exe = await findNvidiaSmi();
    if (!exe) {
      return { available: false, message: 'Detalhes avançados exigem uma GPU NVIDIA com o driver instalado (nvidia-smi).' };
    }

    const fields = [
      'name', 'driver_version', 'vbios_version', 'pci.bus_id', 'pcie.link.gen.current', 'pcie.link.gen.max',
      'pcie.link.width.current', 'pcie.link.width.max', 'memory.total', 'power.limit', 'power.max_limit',
      'clocks.max.gr', 'clocks.max.mem', 'compute_cap',
    ];
    const result = await run(exe, [`--query-gpu=${fields.join(',')}`, '--format=csv,noheader,nounits', '-i', '0']);
    const cols = result.stdout.trim().split(/\r?\n/)[0]?.split(',').map((c) => c.trim());
    if (result.code !== 0 || !cols || cols.length < fields.length) {
      return { available: false, message: 'Não foi possível ler a GPU pelo nvidia-smi.' };
    }

    return {
      available: true,
      name: cols[0],
      driverVersion: cols[1],
      vbios: cols[2],
      pciBus: cols[3],
      pcieGenCurrent: num(cols[4]),
      pcieGenMax: num(cols[5]),
      pcieWidthCurrent: num(cols[6]),
      pcieWidthMax: num(cols[7]),
      vramTotalMb: num(cols[8]),
      powerLimitWatts: num(cols[9]),
      powerMaxWatts: num(cols[10]),
      maxCoreClockMhz: num(cols[11]),
      maxMemoryClockMhz: num(cols[12]),
      computeCapability: cols[13],
    };
  },

  sensor_reset() {
    previousCpu = null;
    extrasAt = 0;
    return null;
  },
});
