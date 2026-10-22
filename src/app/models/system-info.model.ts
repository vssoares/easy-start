export interface GpuInfo {
  name: string;
  driverVersion: string;
  driverDate: string;
  vramMb: number;
  vendor: 'nvidia' | 'amd' | 'intel' | 'other';
  downloadUrl: string;
}

export interface DiskInfo {
  deviceId: string;
  totalGb: number;
  freeGb: number;
}

export interface SystemInfo {
  cpuName: string;
  cpuCores: number;
  cpuLogical: number;
  cpuMhz: number;
  osCaption: string;
  osVersion: string;
  osBuild: string;
  ramTotalKb: number;
  ramFreeKb: number;
  moboManufacturer: string;
  moboProduct: string;
  moboVersion: string;
  gpus: GpuInfo[];
  disks: DiskInfo[];
}

export interface GpuDriverStatus {
  vendor: GpuInfo['vendor'];
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

export interface DriverProgress {
  message: string;
  percent: number;
}
