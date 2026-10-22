export interface MemoryStatus {
  totalMb: number;
  usedMb: number;
  percent: number;
}

export interface BackgroundApp {
  processName: string;
  title: string;
  detail: string;
  memoryBytes: number;
  count: number;
  hasWindow: boolean;
  suggested: boolean;
}

export interface Tweak {
  id: string;
  title: string;
  description: string;
  effect: string;
  needsRestart: boolean;
  needsAdmin: boolean;
  isOn: boolean;
}

export interface CloseAppsResult {
  closed: string[];
  notClosed: string[];
  message?: string;
}

export interface CleanMemoryResult {
  freedBytes: number;
  trimmed: number;
  purged: boolean;
  error: string | null;
  message: string;
}
