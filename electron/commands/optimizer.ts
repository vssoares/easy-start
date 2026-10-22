import os from 'node:os';
import { asArray, psJson, psQuote } from '../ps';
import { registerAll } from '../registry';

/** Programas comuns que consomem recursos em segundo plano e podem ser fechados antes de jogar. */
const SUGGESTED: Record<string, string> = {
  Discord: 'Discord',
  Spotify: 'Spotify',
  Steam: 'Steam',
  steamwebhelper: 'Navegador interno da Steam',
  EpicGamesLauncher: 'Epic Games Launcher',
  Battle: 'Battle.net',
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  firefox: 'Firefox',
  OneDrive: 'OneDrive',
  Teams: 'Microsoft Teams',
  ms_teams: 'Microsoft Teams',
  Slack: 'Slack',
  Skype: 'Skype',
  Telegram: 'Telegram',
  WhatsApp: 'WhatsApp',
  GoogleDriveFS: 'Google Drive',
  Dropbox: 'Dropbox',
  OfficeClickToRun: 'Atualizador do Office',
  AdobeIPCBroker: 'Adobe (comunicação em segundo plano)',
};

/** Processos que nunca aparecem na lista (sistema, segurança, drivers e o próprio app). */
const PROTECTED = [
  'System', 'Idle', 'Registry', 'smss', 'csrss', 'wininit', 'winlogon', 'services', 'lsass', 'lsaiso', 'svchost',
  'dwm', 'explorer', 'fontdrvhost', 'sihost', 'ctfmon', 'taskhostw', 'RuntimeBroker', 'StartMenuExperienceHost',
  'ShellExperienceHost', 'SearchHost', 'SearchIndexer', 'TextInputHost', 'SecurityHealthService', 'SecurityHealthSystray',
  'MsMpEng', 'NisSrv', 'SgrmBroker', 'audiodg', 'conhost', 'dllhost', 'spoolsv', 'WmiPrvSE', 'LockApp',
  'ApplicationFrameHost', 'powershell', 'pwsh', 'cmd', 'Easy Start', 'electron', 'node',
];

interface BackgroundAppDto {
  processName: string;
  title: string;
  memoryBytes: number;
  count: number;
  hasWindow: boolean;
}

/** Aceita só nomes de processo "simples" para nunca montar comandos a partir de texto livre. */
const PROCESS_NAME = /^[\w .\-()]+$/;

registerAll({
  memory_status() {
    const totalMb = Math.round(os.totalmem() / 1048576);
    const usedMb = Math.round((os.totalmem() - os.freemem()) / 1048576);
    return { totalMb, usedMb, percent: totalMb ? Math.round((usedMb / totalMb) * 1000) / 10 : 0 };
  },

  async list_background_apps() {
    const protectedList = PROTECTED.map(psQuote).join(',');
    const rows = asArray(
      await psJson<BackgroundAppDto[]>(`
$protected = @(${protectedList})
$session = (Get-Process -Id $PID).SessionId
$groups = Get-Process | Where-Object { $_.SessionId -eq $session -and ($protected -notcontains $_.ProcessName) } | Group-Object ProcessName
$result = foreach ($g in $groups) {
  $withWindow = @($g.Group | Where-Object { $_.MainWindowHandle -ne 0 })
  $title = $g.Name
  try { $d = $g.Group[0].MainModule.FileVersionInfo.FileDescription; if ($d) { $title = $d } } catch {}
  [PSCustomObject]@{
    processName = $g.Name
    title = $title
    memoryBytes = [double](($g.Group | Measure-Object WorkingSet64 -Sum).Sum)
    count = $g.Count
    hasWindow = ($withWindow.Count -gt 0)
  }
}
ConvertTo-Json -InputObject @($result) -Compress`),
    );

    return rows
      .map((row) => ({
        ...row,
        detail: SUGGESTED[row.processName] ?? (row.hasWindow ? 'Programa aberto' : ''),
        suggested: row.processName in SUGGESTED,
      }))
      .filter((row) => row.hasWindow || row.suggested) // auxiliares sem janela ficam de fora
      .sort((a, b) => Number(b.suggested) - Number(a.suggested) || b.memoryBytes - a.memoryBytes);
  },

  /**
   * Com janela: pede para fechar (como clicar no X), sem forçar, para não perder nada não salvo.
   * Sem janela (segundo plano) e sugerido: encerra.
   */
  async close_apps({ names }: { names: string[] }) {
    const list = asArray(names).filter((name) => PROCESS_NAME.test(name));
    if (list.length === 0) throw new Error('Nenhum programa selecionado.');

    const result = await psJson<{ closed: string[]; notClosed: string[] }>(`
$suggested = @(${Object.keys(SUGGESTED).map(psQuote).join(',')})
$closed = @(); $notClosed = @()
foreach ($name in @(${list.map(psQuote).join(',')})) {
  foreach ($p in Get-Process -Name $name -ErrorAction SilentlyContinue) {
    try {
      if ($p.MainWindowHandle -ne 0) { [void]$p.CloseMainWindow() }
      elseif ($suggested -contains $name) { $p.Kill() }
    } catch {}
  }
  $sw = [Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt 4 -and (Get-Process -Name $name -ErrorAction SilentlyContinue)) { Start-Sleep -Milliseconds 200 }
  if (Get-Process -Name $name -ErrorAction SilentlyContinue) { $notClosed += $name } else { $closed += $name }
}
[PSCustomObject]@{ closed = $closed; notClosed = $notClosed } | ConvertTo-Json -Compress`);

    const closed = asArray(result?.closed);
    const notClosed = asArray(result?.notClosed);
    return {
      closed,
      notClosed,
      message: notClosed.length
        ? `Fechados: ${closed.length}. Continuam abertos: ${notClosed.join(', ')} (podem pedir para salvar algo).`
        : `${closed.length} programa(s) fechado(s).`,
    };
  },

  /**
   * Esvazia o working set dos processos e, com administrador, a lista de espera (standby) da RAM.
   * A standby é cache que o Windows libera sozinho quando precisa; esvaziá-la antes de jogar ajuda quando a RAM está quase cheia.
   */
  async clean_memory() {
    const result = await psJson<{ freedBytes: number; trimmed: number; purged: boolean; error: string | null }>(`
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MemClean {
  [StructLayout(LayoutKind.Sequential, Pack = 4)]
  struct TOKEN_PRIVILEGES { public uint Count; public long Luid; public uint Attributes; }
  [DllImport("psapi.dll")] static extern bool EmptyWorkingSet(IntPtr h);
  [DllImport("ntdll.dll")] static extern int NtSetSystemInformation(int c, ref int i, int l);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool OpenProcessToken(IntPtr p, uint a, out IntPtr t);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool LookupPrivilegeValue(string s, string n, out long l);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool AdjustTokenPrivileges(IntPtr t, bool d, ref TOKEN_PRIVILEGES s, uint len, IntPtr p, IntPtr r);
  public static bool Trim(IntPtr handle) { return EmptyWorkingSet(handle); }
  public static int PurgeStandby() {
    IntPtr token;
    if (!OpenProcessToken(GetCurrentProcess(), 0x28, out token)) return -1;
    long luid;
    if (!LookupPrivilegeValue(null, "SeProfileSingleProcessPrivilege", out luid)) return -1;
    var tp = new TOKEN_PRIVILEGES { Count = 1, Luid = luid, Attributes = 2 };
    AdjustTokenPrivileges(token, false, ref tp, 0, IntPtr.Zero, IntPtr.Zero);
    int command = 4; // MemoryPurgeStandbyList
    return NtSetSystemInformation(80, ref command, 4);
  }
}
'@
function Get-Free { (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory * 1024 }
$before = Get-Free
$trimmed = 0
foreach ($p in Get-Process) {
  if ($p.Id -le 4 -or $p.Id -eq $PID) { continue }
  try { if ([MemClean]::Trim($p.Handle)) { $trimmed++ } } catch {}
}
$status = [MemClean]::PurgeStandby()
Start-Sleep -Milliseconds 300
$freed = [Math]::Max(0, (Get-Free) - $before)
[PSCustomObject]@{
  freedBytes = [double]$freed
  trimmed = $trimmed
  purged = ($status -eq 0)
  error = $(if ($status -eq 0) { $null } else { 'a lista de espera só é esvaziada com o app como administrador' })
} | ConvertTo-Json -Compress`);

    const freedMb = Math.round((result?.freedBytes ?? 0) / 1048576);
    const base = `${freedMb} MB liberados, ${result?.trimmed ?? 0} processos enxugados.`;
    return {
      ...result,
      message: result?.purged ? `${base} Lista de espera esvaziada.` : `${base} Lista de espera não esvaziada: ${result?.error}.`,
    };
  },
});
