use serde::Serialize;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub cpu_name: String,
    pub cpu_cores: i64,
    pub cpu_logical: i64,
    pub cpu_mhz: i64,
    pub os_caption: String,
    pub os_version: String,
    pub os_build: String,
    pub ram_total_kb: i64,
    pub ram_free_kb: i64,
    pub mobo_manufacturer: String,
    pub mobo_product: String,
    pub mobo_version: String,
    pub gpus: Vec<GpuInfo>,
    pub disks: Vec<DiskInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuInfo {
    pub name: String,
    pub driver_version: String,
    pub driver_date: String,
    pub vram_mb: u64,
    pub vendor: String,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskInfo {
    pub device_id: String,
    pub total_gb: f64,
    pub free_gb: f64,
}

const SYSTEM_SCRIPT: &str = r#"
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
      vramBytes     = [long]([uint64]($_.AdapterRAM))
    }
  })
  disks = @($draw | ForEach-Object {
    [PSCustomObject]@{
      deviceId   = [string]$_.DeviceID
      totalBytes = [long]$_.Size
      freeBytes  = [long]$_.FreeSpace
    }
  })
} | ConvertTo-Json -Depth 3
"#;

fn detect_vendor(name: &str) -> (&'static str, &'static str) {
    let lower = name.to_lowercase();
    if lower.contains("nvidia")
        || lower.contains("geforce")
        || lower.contains("quadro")
        || lower.contains("tesla")
    {
        ("nvidia", "https://www.nvidia.com/pt-br/drivers/")
    } else if lower.contains("amd") || lower.contains("radeon") {
        ("amd", "https://www.amd.com/pt/support/download/drivers.html")
    } else if lower.contains("intel")
        || lower.contains("uhd graphics")
        || lower.contains("iris")
        || lower.contains("arc")
    {
        (
            "intel",
            "https://www.intel.com.br/content/www/br/pt/download-center/home.html",
        )
    } else {
        ("other", "")
    }
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    #[cfg(not(windows))]
    return Err("Disponível apenas no Windows.".into());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let output = Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", SYSTEM_SCRIPT])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map_err(|e| format!("Falha ao executar PowerShell: {e}"))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let json = stdout.trim();

        if json.is_empty() {
            return Err("PowerShell não retornou dados do sistema.".into());
        }

        let v: serde_json::Value = serde_json::from_str(json)
            .map_err(|e| format!("Erro ao analisar dados do sistema: {e}"))?;

        let gpus = parse_gpus(&v);
        let disks = parse_disks(&v);

        Ok(SystemInfo {
            cpu_name: str_field(&v, "cpuName", "Desconhecido"),
            cpu_cores: v["cpuCores"].as_i64().unwrap_or(0),
            cpu_logical: v["cpuLogical"].as_i64().unwrap_or(0),
            cpu_mhz: v["cpuMhz"].as_i64().unwrap_or(0),
            os_caption: str_field(&v, "osCaption", ""),
            os_version: str_field(&v, "osVersion", ""),
            os_build: str_field(&v, "osBuild", ""),
            ram_total_kb: v["ramTotalKb"].as_i64().unwrap_or(0),
            ram_free_kb: v["ramFreeKb"].as_i64().unwrap_or(0),
            mobo_manufacturer: str_field(&v, "moboManufacturer", ""),
            mobo_product: str_field(&v, "moboProduct", ""),
            mobo_version: str_field(&v, "moboVersion", ""),
            gpus,
            disks,
        })
    }
}

fn parse_gpus(v: &serde_json::Value) -> Vec<GpuInfo> {
    let arr = match v["gpus"].as_array() {
        Some(a) => a,
        None => return vec![],
    };

    arr.iter()
        .filter_map(|g| {
            let name = g["name"].as_str().unwrap_or("").trim().to_string();
            if name.is_empty() {
                return None;
            }
            let vram_bytes = g["vramBytes"].as_i64().unwrap_or(0) as u64;
            // AdapterRAM overflows for GPUs with >4 GB VRAM; treat max-u32 as unknown
            let vram_mb = if vram_bytes == 0 || vram_bytes == u32::MAX as u64 {
                0
            } else {
                vram_bytes / (1024 * 1024)
            };
            let (vendor, url) = detect_vendor(&name);
            Some(GpuInfo {
                name,
                driver_version: g["driverVersion"].as_str().unwrap_or("").to_string(),
                driver_date: g["driverDate"].as_str().unwrap_or("").to_string(),
                vram_mb,
                vendor: vendor.to_string(),
                download_url: url.to_string(),
            })
        })
        .collect()
}

fn parse_disks(v: &serde_json::Value) -> Vec<DiskInfo> {
    let arr = match v["disks"].as_array() {
        Some(a) => a,
        None => return vec![],
    };

    const GB: f64 = 1024.0 * 1024.0 * 1024.0;

    arr.iter()
        .filter_map(|d| {
            let device_id = d["deviceId"].as_str().unwrap_or("").trim().to_string();
            if device_id.is_empty() {
                return None;
            }
            let total = d["totalBytes"].as_i64().unwrap_or(0) as f64;
            let free = d["freeBytes"].as_i64().unwrap_or(0) as f64;
            Some(DiskInfo {
                device_id,
                total_gb: total / GB,
                free_gb: free / GB,
            })
        })
        .collect()
}

fn str_field(v: &serde_json::Value, key: &str, fallback: &str) -> String {
    v[key]
        .as_str()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

#[tauri::command]
pub fn open_driver_page(url: String) -> Result<(), String> {
    #[cfg(not(windows))]
    return Err("Disponível apenas no Windows.".into());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let url = url.trim().to_string();
        if !url.starts_with("https://") {
            return Err("URL inválida.".into());
        }
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| format!("Falha ao abrir navegador: {e}"))?;
        Ok(())
    }
}
