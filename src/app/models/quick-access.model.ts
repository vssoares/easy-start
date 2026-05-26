export interface KillPortResult {
  port: number;
  pids: number[];
  killed: number[];
  message: string;
}

export interface InspectPortResult {
  port: number;
  processes: { pid: number; name: string }[];
  message: string;
}

export interface ActionResult {
  message: string;
}

export interface LocalIpInfo {
  name: string;
  address: string;
}

export interface QuickFolder {
  id: string;
  label: string;
}

export interface SystemTool {
  id: string;
  label: string;
  description: string;
}
