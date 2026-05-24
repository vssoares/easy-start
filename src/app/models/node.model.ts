export interface NvmStatus {
  installed: boolean;
  nvmPath?: string;
  nvmVersion?: string;
  currentVersion?: string;
}

export interface NodeVersionInfo {
  version: string;
  installed: boolean;
  active: boolean;
  lts?: string;
}

export interface NodeVersionsResponse {
  status: NvmStatus;
  installed: NodeVersionInfo[];
  available: NodeVersionInfo[];
}

export type NodeAction = 'install' | 'uninstall' | 'use';
