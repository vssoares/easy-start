import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { asArray, psJson, psQuote, requireAdmin } from '../ps';
import { registerAll } from '../registry';

type StartupKind = 'Run' | 'Run32' | 'Folder';

interface StartupRef {
  kind: StartupKind;
  machine: boolean;
  name: string;
  filePath?: string;
}

interface StartupBackup extends StartupRef {
  command?: string;
  /** Pasta: cópia do atalho guardada em userData/startup-backup. */
  backup?: string;
  removedAt: string;
}

const BACKUP_INDEX = () => path.join(app.getPath('userData'), 'startup-backup.json');
const BACKUP_DIR = () => path.join(app.getPath('userData'), 'startup-backup');

function readBackups(): StartupBackup[] {
  try {
    return JSON.parse(fs.readFileSync(BACKUP_INDEX(), 'utf8')) as StartupBackup[];
  } catch {
    return [];
  }
}

function writeBackups(items: StartupBackup[]): void {
  fs.mkdirSync(path.dirname(BACKUP_INDEX()), { recursive: true });
  fs.writeFileSync(BACKUP_INDEX(), JSON.stringify(items, null, 2));
}

/** Funções PowerShell compartilhadas entre as ações. */
const HELPERS = `
$RunPath = 'Software\\Microsoft\\Windows\\CurrentVersion\\Run'
$ApprovedPath = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\'

function Get-Root([bool]$machine, [string]$kind) {
  if ($machine) {
    $view = if ($kind -eq 'Run32') { [Microsoft.Win32.RegistryView]::Registry32 } else { [Microsoft.Win32.RegistryView]::Registry64 }
    return [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::LocalMachine, $view)
  }
  return [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryView]::Default)
}

function Get-ApprovedKind([string]$kind) { if ($kind -eq 'Folder') { 'StartupFolder' } else { $kind } }

function Test-Approved([bool]$machine, [string]$kind, [string]$name) {
  try {
    $hive = if ($machine) { [Microsoft.Win32.Registry]::LocalMachine } else { [Microsoft.Win32.Registry]::CurrentUser }
    $key = $hive.OpenSubKey($ApprovedPath + (Get-ApprovedKind $kind))
    if (-not $key) { return $true }
    $value = $key.GetValue($name)
    if ($value -is [byte[]] -and $value.Length -gt 0) { return (($value[0] -band 1) -eq 0) }
    return $true
  } catch { return $true }
}

function Get-ExeFromCommand([string]$cmd) {
  $cmd = [Environment]::ExpandEnvironmentVariables($cmd.Trim())
  if (-not $cmd) { return $null }
  if ($cmd[0] -eq '"') {
    $end = $cmd.IndexOf('"', 1)
    if ($end -le 1) { return $null }
    $p = $cmd.Substring(1, $end - 1)
  } else {
    $exe = $cmd.IndexOf('.exe', [StringComparison]::OrdinalIgnoreCase)
    $sp = $cmd.IndexOf(' ')
    $p = if ($exe -gt 0) { $cmd.Substring(0, $exe + 4) } elseif ($sp -gt 0) { $cmd.Substring(0, $sp) } else { $cmd }
  }
  if ([IO.Path]::IsPathRooted($p)) { return $p }
  $sys = Join-Path ([Environment]::SystemDirectory) $p
  if (Test-Path -LiteralPath $sys) { return $sys }
  return $null
}

function Get-Description([string]$exe) {
  try {
    if (-not $exe -or -not (Test-Path -LiteralPath $exe)) { return '' }
    $v = (Get-Item -LiteralPath $exe).VersionInfo
    return (@($v.FileDescription, $v.CompanyName) | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() } | Select-Object -Unique) -join ' · '
  } catch { return '' }
}
`;

const LIST_SCRIPT = `${HELPERS}
$items = New-Object System.Collections.ArrayList

function Add-RunEntries([bool]$machine, [string]$kind, [string]$source) {
  try {
    $root = Get-Root $machine $kind
    $key = $root.OpenSubKey($RunPath)
    if (-not $key) { return }
    foreach ($name in $key.GetValueNames()) {
      if (-not $name) { continue }
      $cmd = [string]$key.GetValue($name)
      $exe = Get-ExeFromCommand $cmd
      [void]$items.Add([PSCustomObject]@{
        kind = $kind; machine = $machine; name = $name; command = $cmd; source = $source; filePath = $null
        enabled = (Test-Approved $machine $kind $name)
        detail = (Get-Description $exe)
        fileMissing = [bool]($exe -and -not (Test-Path -LiteralPath $exe))
      })
    }
  } catch {}
}

function Add-FolderEntries([string]$folder, [bool]$machine, [string]$source) {
  try {
    if (-not $folder -or -not (Test-Path -LiteralPath $folder)) { return }
    $shell = New-Object -ComObject WScript.Shell
    foreach ($file in Get-ChildItem -LiteralPath $folder -File -Force) {
      if ($file.Name -ieq 'desktop.ini') { continue }
      $target = $null
      if ($file.Extension -ieq '.lnk') {
        try {
          $sc = $shell.CreateShortcut($file.FullName)
          if ($sc.TargetPath) { $target = if ($sc.Arguments) { '"' + $sc.TargetPath + '" ' + $sc.Arguments } else { $sc.TargetPath } }
        } catch {}
      }
      $exe = if ($target) { Get-ExeFromCommand $target } else { $file.FullName }
      [void]$items.Add([PSCustomObject]@{
        kind = 'Folder'; machine = $machine; name = $file.BaseName; command = $(if ($target) { $target } else { $file.FullName })
        source = $source; filePath = $file.FullName
        enabled = (Test-Approved $machine 'Folder' $file.Name)
        detail = (Get-Description $exe)
        fileMissing = [bool]($target -and $exe -and -not (Test-Path -LiteralPath $exe))
      })
    }
  } catch {}
}

Add-RunEntries $false 'Run' 'Registro · usuário'
Add-RunEntries $true 'Run' 'Registro · todos os usuários'
Add-RunEntries $true 'Run32' 'Registro · todos os usuários (32 bits)'
Add-FolderEntries ([Environment]::GetFolderPath('Startup')) $false 'Pasta Inicializar · usuário'
Add-FolderEntries ([Environment]::GetFolderPath('CommonStartup')) $true 'Pasta Inicializar · todos os usuários'

ConvertTo-Json -InputObject @($items | Sort-Object name) -Depth 3 -Compress
`;

interface StartupEntryDto extends StartupRef {
  command: string;
  source: string;
  enabled: boolean;
  detail: string;
  fileMissing: boolean;
}

function assertRef(ref: StartupRef): void {
  if (!['Run', 'Run32', 'Folder'].includes(ref.kind) || !ref.name) {
    throw new Error('Item de inicialização inválido.');
  }
}

async function listEntries(): Promise<StartupEntryDto[]> {
  return asArray(await psJson<StartupEntryDto[]>(LIST_SCRIPT));
}

registerAll({
  list_startup: async () => ({
    entries: await listEntries(),
    removed: readBackups(),
  }),

  async set_startup_enabled({ ref, enabled }: { ref: StartupRef; enabled: boolean }) {
    assertRef(ref);
    if (ref.machine) await requireAdmin('Alterar programas de todos os usuários');

    const approvedName = ref.kind === 'Folder' ? path.basename(ref.filePath ?? ref.name) : ref.name;
    await psJson(`${HELPERS}
$hive = if (${ref.machine ? '$true' : '$false'}) { [Microsoft.Win32.Registry]::LocalMachine } else { [Microsoft.Win32.Registry]::CurrentUser }
$key = $hive.CreateSubKey($ApprovedPath + (Get-ApprovedKind ${psQuote(ref.kind)}))
$data = New-Object byte[] 12
$data[0] = ${enabled ? 2 : 3}
${enabled ? '' : '[BitConverter]::GetBytes([DateTime]::UtcNow.ToFileTimeUtc()).CopyTo($data, 4)'}
$key.SetValue(${psQuote(approvedName)}, $data, [Microsoft.Win32.RegistryValueKind]::Binary)
'true'`);
    return { message: enabled ? `${ref.name} vai abrir com o Windows.` : `${ref.name} não abre mais com o Windows.` };
  },

  async remove_startup({ ref }: { ref: StartupRef }) {
    assertRef(ref);
    if (ref.machine) await requireAdmin('Remover programas de todos os usuários');

    const backup: StartupBackup = { ...ref, removedAt: new Date().toISOString() };

    if (ref.kind === 'Folder') {
      if (!ref.filePath) throw new Error('Arquivo do atalho não informado.');
      fs.mkdirSync(BACKUP_DIR(), { recursive: true });
      const copy = path.join(BACKUP_DIR(), `${Date.now()}-${path.basename(ref.filePath)}`);
      fs.renameSync(ref.filePath, copy);
      backup.backup = copy;
    } else {
      const command = await psJson<string>(`${HELPERS}
$root = Get-Root ${ref.machine ? '$true' : '$false'} ${psQuote(ref.kind)}
$key = $root.OpenSubKey($RunPath, $true)
if (-not $key) { throw 'Chave Run não encontrada.' }
$value = [string]$key.GetValue(${psQuote(ref.name)})
$key.DeleteValue(${psQuote(ref.name)})
ConvertTo-Json -InputObject $value`);
      backup.command = command ?? '';
    }

    // A marcação de ativado/desativado do item removido não faz mais sentido.
    await psJson(`${HELPERS}
try {
  $hive = if (${ref.machine ? '$true' : '$false'}) { [Microsoft.Win32.Registry]::LocalMachine } else { [Microsoft.Win32.Registry]::CurrentUser }
  $k = $hive.OpenSubKey($ApprovedPath + (Get-ApprovedKind ${psQuote(ref.kind)}), $true)
  if ($k) { $k.DeleteValue(${psQuote(ref.kind === 'Folder' ? path.basename(ref.filePath ?? ref.name) : ref.name)}, $false) }
} catch {}
'true'`);

    writeBackups([backup, ...readBackups()]);
    return { message: `${ref.name} removido da inicialização. Dá para restaurar em "Removidos".` };
  },

  async restore_startup({ removedAt }: { removedAt: string }) {
    const all = readBackups();
    const item = all.find((entry) => entry.removedAt === removedAt);
    if (!item) throw new Error('Item removido não encontrado.');
    if (item.machine) await requireAdmin('Restaurar programas de todos os usuários');

    if (item.kind === 'Folder') {
      if (!item.backup || !item.filePath || !fs.existsSync(item.backup)) {
        throw new Error('A cópia do atalho não existe mais.');
      }
      fs.mkdirSync(path.dirname(item.filePath), { recursive: true });
      fs.copyFileSync(item.backup, item.filePath);
      fs.rmSync(item.backup, { force: true });
    } else {
      await psJson(`${HELPERS}
$root = Get-Root ${item.machine ? '$true' : '$false'} ${psQuote(item.kind)}
$key = $root.CreateSubKey($RunPath)
$key.SetValue(${psQuote(item.name)}, ${psQuote(item.command ?? '')}, [Microsoft.Win32.RegistryValueKind]::String)
'true'`);
    }

    writeBackups(all.filter((entry) => entry.removedAt !== removedAt));
    return { message: `${item.name} restaurado.` };
  },
});
