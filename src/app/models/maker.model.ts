export interface UsbDevice {
  instanceId: string;
  name: string;
  class: string;
  present: boolean;
  port: string | null;
  problem: number | null;
  driverKey: string | null;
  maker: string | null;
  vid: string | null;
  pid: string | null;
  suggested: boolean;
}

export interface SerialDevice extends UsbDevice {
  chip: string;
  officialUrl: string;
  driver: string;
  inf: string | null;
  ok: boolean;
  verdict: string;
  advice: string;
}

export interface SerialDriverPackage {
  publishedName: string;
  originalName: string;
  provider: string;
  version: string;
  date: string;
  chip: string;
  inUse: boolean;
}

export interface ComStatus {
  reserved: number[];
  inUse: number[];
}
