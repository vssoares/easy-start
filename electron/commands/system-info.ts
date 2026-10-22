import { shell } from 'electron';
import { requireWindows, runPowerShell } from '../exec';
import { registerAll } from '../registry';

const SYSTEM_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
$cpu  = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1 Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed
$os   = Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, TotalVisibleMemorySize, FreePhysicalMemory
$mobo = Get-CimInstance -ClassName Win32_BaseBoard | Select-Object -First 1 Manufacturer, Product, Version
$graw = @(Get-CimInstance -ClassName Win32_VideoController | Select-Object Name, DriverVersion, DriverDate, AdapterRAM)
$draw = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID, Size, FreeSpace)
[PSCustomObject]@{
  cpuName          = [string]$cpu.Name
  cpuCores         = [int]($cpu.NumberOfCores)
  cpuLogical       = [int]($cpu.NumberOfLogicalProcessors)
  cpuMhz           = [int]($cpu.MaxClockSpeed)
  osCaption        = [string]$os.Caption
  osVersion        = [string]$os.Version
  osBuild          = [string]$os.BuildNumber
  ramTotalKb       = [long]$os.TotalVisibleMemorySize
  ramFreeKb        = [long]$os.FreePhysicalMemory
  moboManufacturer = [string]$mobo.Manufacturer
  moboProduct      = [string]$mobo.Product
  moboVersion      = [string]$mobo.Version
  gpus = @($graw | ForEach-Object {
    [PSCustomObject]@{
      name          = [string]$_.Name
      driverVersion = [string]$_.DriverVersion
      driverDate    = if ($_.DriverDate) { $_.DriverDate.ToString('yyyy-MM-dd') } else { '' }
      vramBytes     = [double]([uint64]($_.AdapterRAM))
    }
  })
  disks = @($draw | ForEach-Object {
    [PSCustomObject]@{
      deviceId   = [string]$_.DeviceID
      totalBytes = [double]$_.Size
      freeBytes  = [double]$_.FreeSpace
    }
  })
} | ConvertTo-Json -Depth 3
`;

const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;

function detectVendor(name: string): { vendor: string; downloadUrl: string } {
  const lower = name.toLowerCase();
  if (['nvidia', 'geforce', 'quadro', 'tesla'].some((k) => lower.includes(k))) {
    return { vendor: 'nvidia', downloadUrl: 'https://www.nvidia.com/pt-br/drivers/' };
  }
  if (lower.includes('amd') || lower.includes('radeon')) {
    return { vendor: 'amd', downloadUrl: 'https://www.amd.com/pt/support/download/drivers.html' };
  }
  if (['intel', 'uhd graphics', 'iris', 'arc'].some((k) => lower.includes(k))) {
    return {
      vendor: 'intel',
      downloadUrl: 'https://www.intel.com.br/content/www/br/pt/download-center/home.html',
    };
  }
  return { vendor: 'other', downloadUrl: '' };
}

const str = (value: unknown, fallback = ''): string => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || fallback;
};

const num = (value: unknown): number => (typeof value === 'number' ? value : 0);

function asArray(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  return value && typeof value === 'object' ? [value] : [];
}

function parseGpus(raw: unknown) {
  return asArray(raw).flatMap((gpu) => {
    const name = str(gpu.name);
    if (!name) return [];

    const vramBytes = num(gpu.vramBytes);
    // AdapterRAM estoura em GPUs com mais de 4 GB; 0 ou 0xFFFFFFFF significam "desconhecido".
    const vramMb = vramBytes === 0 || vramBytes === 0xffffffff ? 0 : Math.floor(vramBytes / MB);
    const { vendor, downloadUrl } = detectVendor(name);

    return [
      {
        name,
        driverVersion: str(gpu.driverVersion),
        driverDate: str(gpu.driverDate),
        vramMb,
        vendor,
        downloadUrl,
      },
    ];
  });
}

function parseDisks(raw: unknown) {
  return asArray(raw).flatMap((disk) => {
    const deviceId = str(disk.deviceId);
    if (!deviceId) return [];
    return [{ deviceId, totalGb: num(disk.totalBytes) / GB, freeGb: num(disk.freeBytes) / GB }];
  });
}

registerAll({
  async get_system_info() {
    requireWindows();

    const result = await runPowerShell(SYSTEM_SCRIPT);
    if (result.spawnError) {
      throw new Error(`Falha ao executar PowerShell: ${result.spawnError}`);
    }

    const json = result.stdout.trim();
    if (!json) {
      throw new Error('PowerShell não retornou dados do sistema.');
    }

    let v: any;
    try {
      v = JSON.parse(json);
    } catch (error) {
      throw new Error(`Erro ao analisar dados do sistema: ${(error as Error).message}`);
    }

    return {
      cpuName: str(v.cpuName, 'Desconhecido'),
      cpuCores: num(v.cpuCores),
      cpuLogical: num(v.cpuLogical),
      cpuMhz: num(v.cpuMhz),
      osCaption: str(v.osCaption),
      osVersion: str(v.osVersion),
      osBuild: str(v.osBuild),
      ramTotalKb: num(v.ramTotalKb),
      ramFreeKb: num(v.ramFreeKb),
      moboManufacturer: str(v.moboManufacturer),
      moboProduct: str(v.moboProduct),
      moboVersion: str(v.moboVersion),
      gpus: parseGpus(v.gpus),
      disks: parseDisks(v.disks),
    };
  },

  async open_driver_page({ url }: { url: string }) {
    requireWindows();

    const target = String(url ?? '').trim();
    if (!target.startsWith('https://')) {
      throw new Error('URL inválida.');
    }
    await shell.openExternal(target);
  },
});
