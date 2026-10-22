export type StartupKind = 'Run' | 'Run32' | 'Folder';

export interface StartupRef {
  kind: StartupKind;
  machine: boolean;
  name: string;
  filePath?: string | null;
}

export interface StartupEntry extends StartupRef {
  command: string;
  source: string;
  enabled: boolean;
  detail: string;
  fileMissing: boolean;
}

export interface StartupRemoved extends StartupRef {
  removedAt: string;
}

export interface StartupList {
  entries: StartupEntry[];
  removed: StartupRemoved[];
}

export interface MessageResult {
  message: string;
}
