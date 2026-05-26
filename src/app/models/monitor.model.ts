export interface MonitorInfo {
  id: string;
  name: string;
  displayName: string;
  deviceName: string;
  connection: string;
  isEnabled: boolean;
  isPrimary: boolean;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
}

export interface MonitorActionResult {
  message: string;
  monitors: MonitorInfo[];
}
