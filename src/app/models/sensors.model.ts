export interface SensorSnapshot {
  at: number;
  cpu: {
    name: string;
    load: number | null;
    busiestCore: number | null;
    busiestCoreIndex: number | null;
    temperature: number | null;
    clockMhz: number | null;
    perCore: number[];
  };
  ram: { usedMb: number; totalMb: number; percent: number };
  gpu: {
    name: string | null;
    load: number | null;
    temperature: number | null;
    coreClockMhz: number | null;
    memoryClockMhz: number | null;
    powerWatts: number | null;
    powerLimitWatts: number | null;
    fanPercent: number | null;
    vramUsedMb: number | null;
    vramTotalMb: number | null;
    vramPercent: number | null;
    thermalThrottle: boolean;
  };
  sources: { gpu: string; cpuTemperature: string };
}

export type GpuDetails =
  | { available: false; message: string }
  | {
      available: true;
      name: string;
      driverVersion: string;
      vbios: string;
      pciBus: string;
      pcieGenCurrent: number | null;
      pcieGenMax: number | null;
      pcieWidthCurrent: number | null;
      pcieWidthMax: number | null;
      vramTotalMb: number | null;
      powerLimitWatts: number | null;
      powerMaxWatts: number | null;
      maxCoreClockMhz: number | null;
      maxMemoryClockMhz: number | null;
      computeCapability: string;
    };

export type Limiter = 'gpu' | 'cpu' | 'vram' | 'ram' | 'thermal' | 'capped';

export interface BottleneckVerdict {
  limiter: Limiter;
  title: string;
  advice: string;
}
