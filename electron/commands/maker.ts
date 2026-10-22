import { app, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { run } from '../exec';
import { asArray, psJson, psQuote, requireAdmin } from '../ps';
import { registerAll } from '../registry';

interface SerialChip {
  name: string;
  vids: string[];
  infs: string[];
  providers: string[];
  officialUrl: string;
}

const CHIPS: SerialChip[] = [
  {
    name: 'CH340/CH341',
    vids: ['1A86'],
    infs: ['ch341ser.inf', 'ch343ser.inf', 'ch341s64.inf'],
    providers: ['wch'],
    officialUrl: 'https://www.wch-ic.com/downloads/CH341SER_EXE.html',
  },
  {
    name: 'CP210x',
    vids: ['10C4'],
    infs: ['silabser.inf', 'slabvcp.inf', 'silabenm.inf'],
    providers: ['silicon lab'],
    officialUrl: 'https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers',
  },
  {
    name: 'FTDI',
    vids: ['0403'],
    infs: ['ftdibus.inf', 'ftdiport.inf'],
    providers: ['ftdi'],
    officialUrl: 'https://ftdichip.com/drivers/vcp-drivers/',
  },
  {
    name: 'Prolific PL2303',
    vids: ['067B'],
    infs: ['ser2pl.inf'],
    providers: ['prolific'],
    officialUrl: 'https://www.prolific.com.tw/',
  },
  {
    name: 'Arduino',
    vids: ['2341', '2A03'],
    infs: ['arduino.inf', 'genuino.inf', 'arduino-org.inf', 'linino-boards_amd64.inf'],
    providers: ['arduino'],
    officialUrl: 'https://www.arduino.cc/en/software',
  },
];

/** Fabricantes por Vendor ID USB (placas e conversores USB-serial comuns). */
const VENDORS: Record<string, string> = {
  '2341': 'Arduino', '2A03': 'Arduino', '1A86': 'CH340/CH341', '0403': 'FTDI', '10C4': 'CP210x',
  '303A': 'Espressif (ESP32)', '239A': 'Adafruit', '16C0': 'Teensy', '1B4F': 'SparkFun',
  '2E8A': 'Raspberry Pi Pico', '067B': 'Prolific PL2303', '0483': 'STMicro', '1366': 'SEGGER',
};

const RELEVANT_CLASSES = ['Ports', 'USB', 'USBDevice', 'libusbK devices', 'libusb-win32 devices', 'WinUSB', 'Modem'];
const ARBITER_KEY = 'SYSTEM\\CurrentControlSet\\Control\\COM Name Arbiter';

const comDbBackupFile = () => path.join(app.getPath('userData'), 'comdb-backup.txt');

interface RawDevice {
  instanceId: string;
  name: string;
  class: string;
  present: boolean;
  port: string | null;
  problem: number | null;
  driverKey: string | null;
}

export interface UsbDevice extends RawDevice {
  maker: string | null;
  vid: string | null;
  pid: string | null;
  /** Fantasma USB de porta COM ou de placa conhecida (candidato à limpeza). */
  suggested: boolean;
}

/** Lista todos os dispositivos relevantes, conectados ou "fantasmas" (registrados e ausentes). */
async function listDevices(): Promise<UsbDevice[]> {
  const classes = RELEVANT_CLASSES.map(psQuote).join(',');
  const vids = Object.keys(VENDORS).map(psQuote).join(',');

  const raw = asArray(
    await psJson<RawDevice[]>(`
$classes = @(${classes})
$vids = @(${vids})
$devices = Get-PnpDevice -ErrorAction SilentlyContinue | Where-Object {
  $id = $_.InstanceId
  $vidMatch = $id -match 'VID_([0-9A-F]{4})'
  $known = $vidMatch -and ($vids -contains $Matches[1].ToUpper())
  ($classes -contains $_.Class) -or $known
}
$result = foreach ($d in $devices) {
  if ($d.Class -eq 'USB' -and ($d.InstanceId -like 'USB\\ROOT_HUB*' -or $d.InstanceId -like 'PCI\\*')) { continue }
  $present = $d.Present -eq $true
  $port = $null
  if ($d.FriendlyName -match '\\((COM\\d+)\\)') { $port = $Matches[1] }
  $problem = $null
  if ($present) {
    try {
      $code = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_ProblemCode' -ErrorAction Stop).Data
      if ($code -and [int]$code -ne 0) { $problem = [int]$code }
    } catch {}
  }
  $driverKey = $null
  if ($present) {
    try { $driverKey = (Get-PnpDeviceProperty -InstanceId $d.InstanceId -KeyName 'DEVPKEY_Device_Driver' -ErrorAction Stop).Data } catch {}
  }
  [PSCustomObject]@{
    instanceId = $d.InstanceId
    name = $(if ($d.FriendlyName) { $d.FriendlyName } else { $d.InstanceId })
    class = [string]$d.Class
    present = $present
    port = $port
    problem = $problem
    driverKey = $driverKey
  }
}
ConvertTo-Json -InputObject @($result) -Compress -Depth 3`),
  );

  return raw
    .map((device): UsbDevice => {
      const vid = /VID_([0-9A-F]{4})/i.exec(device.instanceId)?.[1]?.toUpperCase() ?? null;
      const pid = /PID_([0-9A-F]{4})/i.exec(device.instanceId)?.[1]?.toUpperCase() ?? null;
      const maker = vid ? (VENDORS[vid] ?? null) : null;
      const isAcpi = device.instanceId.toUpperCase().startsWith('ACPI\\');
      return {
        ...device,
        maker,
        vid,
        pid,
        suggested: !device.present && !isAcpi && (device.class.toLowerCase() === 'ports' || maker !== null),
      };
    })
    .sort(
      (a, b) =>
        Number(a.present) - Number(b.present) ||
        Number(b.maker !== null) - Number(a.maker !== null) ||
        Number(a.port === null) - Number(b.port === null) ||
        a.name.localeCompare(b.name),
    );
}

const chipByVid = (vid: string | null) => (vid ? CHIPS.find((chip) => chip.vids.includes(vid)) : undefined);

async function driverInfo(driverKey: string | null): Promise<{ provider: string; version: string; inf: string | null }> {
  if (!driverKey) return { provider: '', version: '', inf: null };
  try {
    return await psJson<{ provider: string; version: string; inf: string | null }>(`
$k = Get-ItemProperty -LiteralPath ${psQuote(`HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\${driverKey}`)}
[PSCustomObject]@{ provider = [string]$k.ProviderName; version = [string]$k.DriverVersion; inf = $(if ($k.InfPath) { [string]$k.InfPath } else { $null }) } | ConvertTo-Json -Compress`);
  } catch {
    return { provider: '', version: '', inf: null };
  }
}

function diagnose(device: UsbDevice, chip: SerialChip): { ok: boolean; verdict: string; advice: string } {
  if (chip.name === 'FTDI' && device.pid === '0000') {
    return {
      ok: false,
      verdict: 'Chip FTDI falsificado travado (PID 0000)',
      advice:
        'Um driver FTDI de 2014 zerou o identificador de chips FTDI falsificados. O Windows não reconhece mais a placa. ' +
        'Dá para recuperar regravando o PID 6001 com o FT_Prog (programa gratuito da FTDI) ou trocar o conversor.',
    };
  }

  switch (device.problem) {
    case null:
      return { ok: true, verdict: device.port ? `Funcionando na ${device.port}` : 'Funcionando', advice: '' };
    case 28:
      return {
        ok: false,
        verdict: 'Sem driver (código 28)',
        advice: 'Instale o driver oficial do chip pela página do fabricante e clique em REINSTALAR.',
      };
    case 10: {
      const byChip: Record<string, string> = {
        'CH340/CH341':
          'Comum em clones do CH340 com a versão mais nova do driver. Tente REINSTALAR. Se continuar, remova a versão mais nova do driver CH340 na lista abaixo para o Windows usar a anterior, ou instale a da página oficial.',
        FTDI: 'Pode ser um chip FTDI falsificado: os drivers FTDI recentes não funcionam com cópias. Remova a versão mais nova do driver FTDI na lista abaixo para voltar a uma anterior, ou troque por um conversor original/CH340.',
        'Prolific PL2303':
          'Os drivers Prolific atuais recusam chips PL2303 antigos ou falsificados. Remova a versão mais nova do driver na lista abaixo para voltar a uma anterior.',
      };
      return {
        ok: false,
        verdict: 'O dispositivo não inicia (código 10)',
        advice: byChip[chip.name] ?? 'Tente REINSTALAR. Se continuar, troque o cabo e a porta USB (prefira portas traseiras, sem hub).',
      };
    }
    case 43:
      return {
        ok: false,
        verdict: 'O Windows parou o dispositivo (código 43)',
        advice: 'Geralmente cabo ruim, só de carga, ou porta USB com pouca energia. Troque o cabo e a porta e clique em REINSTALAR.',
      };
    case 22:
      return { ok: false, verdict: 'Dispositivo desativado (código 22)', advice: 'Clique em REINSTALAR para ativar de novo.' };
    default:
      return {
        ok: false,
        verdict: `Problema no driver (código ${device.problem})`,
        advice: 'Clique em REINSTALAR. Se não resolver, instale o driver da página oficial.',
      };
  }
}

// ---- Pacotes de driver (pnputil) ----

interface DriverPackage {
  publishedName: string;
  originalName: string;
  provider: string;
  version: string;
  date: string;
  chip: string;
  inUse: boolean;
}

/** Lê a saída do `pnputil /enum-drivers`, que vem localizada: usamos a ordem dos campos, não os rótulos. */
function parsePnputil(output: string): Omit<DriverPackage, 'chip' | 'inUse'>[] {
  const blocks = output.split(/\r?\n\s*\r?\n/);
  const packages: Omit<DriverPackage, 'chip' | 'inUse'>[] = [];

  for (const block of blocks) {
    const values = block
      .split(/\r?\n/)
      .map((line) => line.split(/:\s+/).slice(1).join(': ').trim())
      .filter(Boolean);
    const published = values.find((value) => /^oem\d+\.inf$/i.test(value));
    if (!published) continue;

    const original = values.find((value) => /\.inf$/i.test(value) && value !== published) ?? '';
    const versionLine = values.find((value) => /\d+\/\d+\/\d+\s+\d+\.\d+/.test(value) || /\d{4}-\d{2}-\d{2}\s+[\d.]+/.test(value)) ?? '';
    const [date = '', version = ''] = versionLine.split(/\s+/);
    const provider = values[values.indexOf(published) + 1] ?? '';

    packages.push({ publishedName: published, originalName: original, provider, version, date });
  }
  return packages;
}

async function listDriverPackages(usedInfs: Set<string>): Promise<DriverPackage[]> {
  const result = await run('pnputil', ['/enum-drivers']);
  return parsePnputil(result.stdout).flatMap((pkg) => {
    const chip = CHIPS.find(
      (c) =>
        c.infs.includes(pkg.originalName.toLowerCase()) ||
        c.providers.some((p) => pkg.provider.toLowerCase().includes(p)),
    );
    if (!chip) return [];
    return [{ ...pkg, chip: chip.name, inUse: usedInfs.has(pkg.publishedName.toLowerCase()) }];
  });
}

function assertInstanceId(id: string): void {
  if (typeof id !== 'string' || !/^[\w\\&.\-{}#]+$/.test(id)) {
    throw new Error('Identificador de dispositivo inválido.');
  }
}

// ---- ComDB ----

async function comStatus() {
  return psJson<{ reserved: number[]; inUse: number[] }>(`
$reserved = @()
$db = (Get-ItemProperty -LiteralPath 'HKLM:\\${ARBITER_KEY}' -Name ComDB -ErrorAction SilentlyContinue).ComDB
if ($db) { for ($n = 1; $n -le $db.Length * 8; $n++) { if ($db[[int][Math]::Floor(($n - 1) / 8)] -band (1 -shl (($n - 1) % 8))) { $reserved += $n } } }
$inUse = @()
$map = Get-ItemProperty -LiteralPath 'HKLM:\\HARDWARE\\DEVICEMAP\\SERIALCOMM' -ErrorAction SilentlyContinue
if ($map) { foreach ($p in $map.PSObject.Properties) { if ($p.Value -is [string] -and $p.Value -match '^COM(\\d+)$') { $inUse += [int]$Matches[1] } } }
[PSCustomObject]@{ reserved = @($reserved); inUse = @($inUse | Sort-Object -Unique) } | ConvertTo-Json -Compress`);
}

registerAll({
  async list_serial_devices() {
    const devices = (await listDevices()).filter((d) => d.present && chipByVid(d.vid));
    const rows = [];

    for (const device of devices) {
      const chip = chipByVid(device.vid)!;
      // FTDI tem dois nós (USB\ barramento + FTDIBUS\ porta): mostra só o da porta, a não ser que o de barramento tenha problema.
      if (chip.name === 'FTDI' && device.instanceId.toUpperCase().startsWith('USB\\') && device.problem === null && device.pid !== '0000') {
        continue;
      }
      const info = await driverInfo(device.driverKey);
      rows.push({
        ...device,
        chip: chip.name,
        officialUrl: chip.officialUrl,
        driver: info.inf ? `${info.provider} ${info.version} · ${info.inf}`.trim() : 'sem driver',
        inf: info.inf,
        ...diagnose(device, chip),
      });
    }
    return rows;
  },

  async list_ghost_devices() {
    return (await listDevices()).filter((d) => !d.present);
  },

  async remove_ghost_devices({ instanceIds }: { instanceIds: string[] }) {
    await requireAdmin('Remover dispositivos antigos');
    const ids = asArray(instanceIds);
    if (ids.length === 0) throw new Error('Nenhum dispositivo selecionado.');

    // Só remove o que está ausente: conectados são ignorados por segurança.
    const present = new Set((await listDevices()).filter((d) => d.present).map((d) => d.instanceId.toLowerCase()));
    let removed = 0;
    const failed: string[] = [];

    for (const id of ids) {
      assertInstanceId(id);
      if (present.has(id.toLowerCase())) {
        failed.push(`${id} (está conectado)`);
        continue;
      }
      const result = await run('pnputil', ['/remove-device', id]);
      if (result.code === 0) removed++;
      else failed.push(`${id} (${result.stdout.trim().split(/\r?\n/).pop() || 'falhou'})`);
    }

    return {
      removed,
      failed,
      message: failed.length ? `${removed} removido(s). Falhas: ${failed.join('; ')}` : `${removed} dispositivo(s) antigo(s) removido(s).`,
    };
  },

  async reinstall_device({ instanceId }: { instanceId: string }) {
    await requireAdmin('Reinstalar dispositivo');
    assertInstanceId(instanceId);

    const remove = await run('pnputil', ['/remove-device', instanceId]);
    if (remove.code !== 0) throw new Error(remove.stdout.trim().split(/\r?\n/).pop() || 'Não foi possível remover o dispositivo.');
    await run('pnputil', ['/scan-devices']);
    return { message: 'Dispositivo reinstalado. Se não reaparecer, desconecte e conecte o cabo.' };
  },

  async list_serial_driver_packages() {
    const used = new Set<string>();
    for (const device of (await listDevices()).filter((d) => d.present && chipByVid(d.vid))) {
      const info = await driverInfo(device.driverKey);
      if (info.inf) used.add(info.inf.toLowerCase());
    }
    return listDriverPackages(used);
  },

  async remove_serial_driver_package({ publishedName }: { publishedName: string }) {
    await requireAdmin('Remover driver');
    if (!/^oem\d+\.inf$/i.test(publishedName)) throw new Error('Nome de pacote inválido.');

    // Só pacotes de chips seriais conhecidos podem ser removidos por aqui.
    const known = await listDriverPackages(new Set());
    if (!known.some((pkg) => pkg.publishedName.toLowerCase() === publishedName.toLowerCase())) {
      throw new Error('Esse pacote não é de um chip serial conhecido.');
    }

    const result = await run('pnputil', ['/delete-driver', publishedName, '/uninstall', '/force']);
    if (result.code !== 0) throw new Error(result.stdout.trim().split(/\r?\n/).pop() || 'Não foi possível remover o driver.');
    await run('pnputil', ['/scan-devices']);
    return { message: `Driver ${publishedName} removido. O Windows usa a versão anterior, se houver.` };
  },

  async com_status() {
    return comStatus();
  },

  /** Mantém no ComDB só as portas em uso agora, liberando os números presos por dispositivos antigos. */
  async rebuild_comdb() {
    await requireAdmin('Liberar números de porta COM');
    const status = await comStatus();

    const result = await psJson<{ old: string }>(`
$path = 'HKLM:\\${ARBITER_KEY}'
$old = (Get-ItemProperty -LiteralPath $path -Name ComDB).ComDB
if (-not $old) { $old = New-Object byte[] 32 }
$db = New-Object byte[] ([Math]::Max(32, $old.Length))
foreach ($p in @(${asArray(status.inUse).join(',') || ''})) { if ($p -ge 1 -and $p -le $db.Length * 8) { $db[[int][Math]::Floor(($p - 1) / 8)] = $db[[int][Math]::Floor(($p - 1) / 8)] -bor (1 -shl (($p - 1) % 8)) } }
Set-ItemProperty -LiteralPath $path -Name ComDB -Value $db -Type Binary
[PSCustomObject]@{ old = [Convert]::ToBase64String($old) } | ConvertTo-Json -Compress`);

    fs.mkdirSync(path.dirname(comDbBackupFile()), { recursive: true });
    fs.writeFileSync(comDbBackupFile(), result.old);

    const freed = asArray(status.reserved).filter((n) => !asArray(status.inUse).includes(n)).length;
    return { message: `${freed} número(s) de porta COM liberado(s). Reconecte a placa para ela pegar uma porta baixa.` };
  },

  async restore_comdb() {
    await requireAdmin('Restaurar reservas de porta COM');
    if (!fs.existsSync(comDbBackupFile())) throw new Error('Não há backup das reservas de porta COM.');
    const base64 = fs.readFileSync(comDbBackupFile(), 'utf8').trim();

    await psJson(`
Set-ItemProperty -LiteralPath 'HKLM:\\${ARBITER_KEY}' -Name ComDB -Value ([Convert]::FromBase64String(${psQuote(base64)})) -Type Binary
'true'`);
    return { message: 'Reservas de porta COM restauradas.' };
  },

  async open_driver_page({ url }: { url: string }) {
    // Só abre as páginas oficiais conhecidas.
    if (!CHIPS.some((chip) => chip.officialUrl === url)) throw new Error('Endereço não permitido.');
    await shell.openExternal(url);
    return { message: 'Página oficial aberta no navegador.' };
  },
});
