export type InstallStatus = 'pending' | 'installing' | 'done' | 'failed' | 'skipped';

export interface InstallJob {
  appId: string;
  name: string;
  wingetId: string;
  status: InstallStatus;
  message: string;
}

export interface InstallProgressEvent {
  appId: string;
  name: string;
  status: InstallStatus;
  message: string;
  index: number;
  total: number;
}

export interface InstallRequest {
  appId: string;
  name: string;
  wingetId: string;
}

export interface InstallBatchResult {
  jobs: InstallJob[];
  wingetAvailable: boolean;
}
