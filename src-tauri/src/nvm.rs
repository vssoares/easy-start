use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use std::{env, fs};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const NVM_WINGET_ID: &str = "CoreyButler.NVMforWindows";
const NVM_SETUP_URL: &str =
    "https://github.com/coreybutler/nvm-windows/releases/download/1.2.2/nvm-setup.exe";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NvmStatus {
    pub installed: bool,
    pub nvm_path: Option<String>,
    pub nvm_version: Option<String>,
    pub current_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeVersionInfo {
    pub version: String,
    pub installed: bool,
    pub active: bool,
    pub lts: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeVersionsResponse {
    pub status: NvmStatus,
    pub installed: Vec<NodeVersionInfo>,
    pub available: Vec<NodeVersionInfo>,
}

#[derive(Debug, Deserialize)]
struct NodeDistEntry {
    version: String,
    lts: serde_json::Value,
}

fn new_command(program: &str) -> Command {
    let mut command = Command::new(program);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

fn find_nvm_exe() -> Option<PathBuf> {
    if let Ok(nvm_home) = env::var("NVM_HOME") {
        let path = PathBuf::from(&nvm_home).join("nvm.exe");
        if path.exists() {
            return Some(path);
        }
    }

    let candidates = [
        PathBuf::from(r"C:\Program Files\nvm\nvm.exe"),
        env::var("APPDATA")
            .ok()
            .map(|appdata| PathBuf::from(appdata).join("nvm").join("nvm.exe"))
            .unwrap_or_default(),
    ];

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate);
        }
    }

    None
}

fn nvm_exe() -> Result<PathBuf, String> {
    find_nvm_exe().ok_or_else(|| "NVM for Windows não encontrado.".to_string())
}

fn run_nvm(args: &[&str]) -> Result<String, String> {
    let nvm = nvm_exe()?;
    let nvm_dir = nvm
        .parent()
        .ok_or_else(|| "Diretório do NVM inválido.".to_string())?;

    let mut command = new_command(nvm.to_str().unwrap_or("nvm.exe"));
    command.args(args);
    command.current_dir(nvm_dir);

    if let Ok(nvm_home) = env::var("NVM_HOME") {
        command.env("NVM_HOME", nvm_home);
    } else {
        command.env("NVM_HOME", nvm_dir);
    }

    if let Ok(nvm_symlink) = env::var("NVM_SYMLINK") {
        command.env("NVM_SYMLINK", nvm_symlink);
    } else {
        command.env("NVM_SYMLINK", r"C:\Program Files\nodejs");
    }

    let output = command
        .output()
        .map_err(|error| format!("Falha ao executar nvm: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let combined = format!("{stdout}\n{stderr}").trim().to_string();

    if output.status.success() {
        Ok(combined)
    } else {
        Err(if combined.is_empty() {
            format!("nvm falhou com código {}", output.status.code().unwrap_or(-1))
        } else {
            combined
        })
    }
}

fn normalize_version(version: &str) -> String {
    version.trim().trim_start_matches('v').to_string()
}

fn parse_installed_versions(output: &str) -> Vec<(String, bool)> {
    let mut versions = Vec::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let active = trimmed.starts_with('*');
        let cleaned = trimmed.trim_start_matches('*').trim();
        let token = cleaned.split_whitespace().next().unwrap_or("");

        if token.chars().next().is_some_and(|c| c.is_ascii_digit()) {
            versions.push((normalize_version(token), active));
        }
    }

    versions
}

fn is_stable_semver(version: &str) -> bool {
    let normalized = normalize_version(version);
    let parts: Vec<&str> = normalized.split('.').collect();
    parts.len() == 3 && parts.iter().all(|part| !part.is_empty() && part.chars().all(|c| c.is_ascii_digit()))
}

fn major_version(version: &str) -> Option<u32> {
    normalize_version(version)
        .split('.')
        .next()
        .and_then(|part| part.parse().ok())
}

fn latest_lts_per_major(
    versions: std::collections::BTreeMap<String, Option<String>>,
) -> Vec<(String, Option<String>)> {
    let mut by_major: std::collections::BTreeMap<u32, (String, Option<String>)> =
        std::collections::BTreeMap::new();

    for (version, lts) in versions {
        if lts.is_none() {
            continue;
        }

        if let Some(major) = major_version(&version) {
            let replace = match by_major.get(&major) {
                None => true,
                Some((current, _)) => compare_versions(&version, current) == std::cmp::Ordering::Greater,
            };

            if replace {
                by_major.insert(major, (version, lts));
            }
        }
    }

    let mut result: Vec<(String, Option<String>)> = by_major.into_values().collect();
    result.sort_by(|a, b| compare_versions(&a.0, &b.0));
    result
}

fn compare_versions(a: &str, b: &str) -> std::cmp::Ordering {
    let parse = |value: &str| {
        normalize_version(value)
            .split('.')
            .map(|part| part.parse::<u32>().unwrap_or(0))
            .collect::<Vec<_>>()
    };

    let pa = parse(a);
    let pb = parse(b);

    for i in 0..3 {
        match pb.get(i).unwrap_or(&0).cmp(&pa.get(i).unwrap_or(&0)) {
            std::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }

    std::cmp::Ordering::Equal
}

fn fetch_available_versions() -> Result<Vec<(String, Option<String>)>, String> {
    let json = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| format!("Cliente HTTP: {error}"))?
        .get("https://nodejs.org/dist/index.json")
        .send()
        .map_err(|error| format!("Falha ao buscar versões do Node: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Resposta inválida do nodejs.org: {error}"))?
        .text()
        .map_err(|error| format!("Falha ao ler versões do Node: {error}"))?;

    let entries: Vec<NodeDistEntry> =
        serde_json::from_str(&json).map_err(|error| format!("Erro ao ler versões do Node: {error}"))?;

    let mut versions: std::collections::BTreeMap<String, Option<String>> =
        std::collections::BTreeMap::new();

    for entry in entries {
        let version = normalize_version(&entry.version);
        if !is_stable_semver(&version) {
            continue;
        }

        let lts = match entry.lts {
            serde_json::Value::Bool(false) | serde_json::Value::Null => None,
            serde_json::Value::Bool(true) => Some("LTS".to_string()),
            serde_json::Value::String(name) if !name.is_empty() => Some(name),
            _ => None,
        };

        if lts.is_some() {
            versions.insert(version, lts);
        }
    }

    Ok(latest_lts_per_major(versions))
}

fn install_nvm_windows() -> Result<(), String> {
    if find_nvm_exe().is_some() {
        return Ok(());
    }

    let winget_result = new_command("winget")
        .args([
            "install",
            "-e",
            "--id",
            NVM_WINGET_ID,
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--disable-interactivity",
        ])
        .output();

    if let Ok(output) = winget_result {
        if output.status.success() || find_nvm_exe().is_some() {
            return Ok(());
        }
    }

    let temp_dir = env::temp_dir();
    let installer = temp_dir.join("nvm-setup.exe");

    let installer_bytes = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(|error| format!("Cliente HTTP: {error}"))?
        .get(NVM_SETUP_URL)
        .send()
        .map_err(|error| format!("Falha ao baixar NVM: {error}"))?
        .error_for_status()
        .map_err(|error| format!("Download do NVM inválido: {error}"))?
        .bytes()
        .map_err(|error| format!("Falha ao ler instalador NVM: {error}"))?;

    fs::write(&installer, installer_bytes).map_err(|error| format!("Falha ao salvar NVM: {error}"))?;

    if !installer.exists() {
        return Err("Download do instalador NVM falhou.".to_string());
    }

    let install_status = new_command(installer.to_str().unwrap_or("nvm-setup.exe"))
        .args(["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"])
        .status()
        .map_err(|error| format!("Falha ao executar instalador NVM: {error}"))?;

    let _ = fs::remove_file(installer);

    if !install_status.success() && find_nvm_exe().is_none() {
        return Err("Instalação do NVM for Windows falhou.".to_string());
    }

    Ok(())
}

fn active_version_from_list(installed: &[(String, bool)]) -> Option<String> {
    installed
        .iter()
        .find(|(_, active)| *active)
        .map(|(version, _)| version.clone())
}

fn build_status_with_list(list_output: Option<&str>) -> NvmStatus {
    let nvm_path = find_nvm_exe();
    let installed = nvm_path.is_some();

    let installed_pairs = list_output
        .map(parse_installed_versions)
        .unwrap_or_default();

    let nvm_version = if installed {
        run_nvm(&["version"]).ok()
    } else {
        None
    };

    let current_version = if installed {
        active_version_from_list(&installed_pairs).or_else(|| {
            run_nvm(&["current"]).ok().map(|v| normalize_version(&v))
        })
    } else {
        None
    };

    NvmStatus {
        installed,
        nvm_path: nvm_path.map(|path| path.to_string_lossy().to_string()),
        nvm_version,
        current_version,
    }
}

fn build_status() -> NvmStatus {
    build_status_with_list(None)
}

fn build_versions_response() -> Result<NodeVersionsResponse, String> {
    let list_output = if find_nvm_exe().is_some() {
        run_nvm(&["list"]).ok()
    } else {
        None
    };

    let status = build_status_with_list(list_output.as_deref());

    let installed_map: std::collections::HashMap<String, bool> = if status.installed {
        list_output
            .as_deref()
            .map(parse_installed_versions)
            .unwrap_or_default()
            .into_iter()
            .map(|(version, active)| (version, active))
            .collect()
    } else {
        std::collections::HashMap::new()
    };

    let installed = installed_map
        .iter()
        .map(|(version, active)| NodeVersionInfo {
            version: version.clone(),
            installed: true,
            active: *active,
            lts: None,
        })
        .collect::<Vec<_>>();

    let available = fetch_available_versions()?
        .into_iter()
        .map(|(version, lts)| NodeVersionInfo {
            version: version.clone(),
            installed: installed_map.contains_key(&version),
            active: status
                .current_version
                .as_ref()
                .is_some_and(|current| current == &version),
            lts,
        })
        .collect();

    Ok(NodeVersionsResponse {
        status,
        installed,
        available,
    })
}

#[tauri::command]
pub fn nvm_status() -> NvmStatus {
    build_status()
}

#[tauri::command]
pub async fn ensure_nvm() -> Result<NodeVersionsResponse, String> {
    if find_nvm_exe().is_none() {
        tauri::async_runtime::spawn_blocking(install_nvm_windows)
            .await
            .map_err(|error| format!("Erro interno: {error}"))??;
    }

    tauri::async_runtime::spawn_blocking(build_versions_response)
        .await
        .map_err(|error| format!("Erro interno: {error}"))?
}

#[tauri::command]
pub async fn list_node_versions() -> Result<NodeVersionsResponse, String> {
    tauri::async_runtime::spawn_blocking(build_versions_response)
        .await
        .map_err(|error| format!("Erro interno: {error}"))?
}

#[tauri::command]
pub async fn install_node_version(version: String) -> Result<NodeVersionsResponse, String> {
    let version = normalize_version(&version);
    tauri::async_runtime::spawn_blocking(move || {
        run_nvm(&["install", &version])?;
        build_versions_response()
    })
    .await
    .map_err(|error| format!("Erro interno: {error}"))?
}

#[tauri::command]
pub async fn uninstall_node_version(version: String) -> Result<NodeVersionsResponse, String> {
    let version = normalize_version(&version);
    tauri::async_runtime::spawn_blocking(move || {
        run_nvm(&["uninstall", &version])?;
        build_versions_response()
    })
    .await
    .map_err(|error| format!("Erro interno: {error}"))?
}

#[tauri::command]
pub async fn use_node_version(version: String) -> Result<NodeVersionsResponse, String> {
    let version = normalize_version(&version);
    tauri::async_runtime::spawn_blocking(move || {
        run_nvm(&["use", &version]).map_err(|error| {
            format!(
                "{error}\n\nDica: execute o app como administrador ou ative o Modo Desenvolvedor do Windows."
            )
        })?;
        build_versions_response()
    })
    .await
    .map_err(|error| format!("Erro interno: {error}"))?
}

#[cfg(windows)]
pub fn platform_supported() -> bool {
    true
}

#[cfg(not(windows))]
pub fn platform_supported() -> bool {
    false
}

#[tauri::command]
pub fn node_manager_supported() -> bool {
    platform_supported()
}
