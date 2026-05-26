use serde::Serialize;
use std::env;
use std::path::PathBuf;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActionResult {
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalIpInfo {
    pub name: String,
    pub address: String,
}

fn windows_only() -> Result<(), String> {
    #[cfg(not(windows))]
    return Err("Disponível apenas no Windows.".into());
    #[cfg(windows)]
    Ok(())
}

fn run_output(mut cmd: Command) -> Result<String, String> {
    let output = cmd
        .output()
        .map_err(|error| format!("Falha ao executar: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}\n{stderr}").trim().to_string();

    if output.status.success() {
        return Ok(if combined.is_empty() {
            "Concluído.".to_string()
        } else {
            combined
        });
    }

    Err(if combined.is_empty() {
        "Comando falhou.".to_string()
    } else {
        combined
    })
}

#[cfg(windows)]
fn known_folder_path(folder: &str) -> Result<PathBuf, String> {
    let path = match folder {
        "desktop" => env::var("USERPROFILE").map(|h| PathBuf::from(h).join("Desktop")),
        "downloads" => env::var("USERPROFILE").map(|h| PathBuf::from(h).join("Downloads")),
        "documents" => env::var("USERPROFILE").map(|h| PathBuf::from(h).join("Documents")),
        "pictures" => env::var("USERPROFILE").map(|h| PathBuf::from(h).join("Pictures")),
        "appdata" => env::var("APPDATA").map(PathBuf::from),
        "localappdata" => env::var("LOCALAPPDATA").map(PathBuf::from),
        "temp" => env::var("TEMP").map(PathBuf::from),
        "home" => env::var("USERPROFILE").map(PathBuf::from),
        _ => return Err(format!("Pasta desconhecida: {folder}")),
    }
    .map_err(|_| format!("Variável de ambiente não encontrada para '{folder}'."))?;

    if !path.exists() {
        return Err(format!("Pasta não existe: {}", path.display()));
    }

    Ok(path)
}

#[cfg(windows)]
fn open_in_explorer(path: &PathBuf) -> Result<(), String> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|error| format!("Falha ao abrir pasta: {error}"))?;
    Ok(())
}

#[tauri::command]
pub fn open_special_folder(folder: String) -> Result<ActionResult, String> {
    windows_only()?;

    #[cfg(windows)]
    {
        let path = known_folder_path(folder.trim())?;
        open_in_explorer(&path)?;
        return Ok(ActionResult {
            message: format!("Abrindo {}", path.display()),
        });
    }

    #[cfg(not(windows))]
    unreachable!()
}

#[tauri::command]
pub fn flush_dns() -> Result<ActionResult, String> {
    windows_only()?;

    #[cfg(windows)]
    {
        let mut cmd = Command::new("ipconfig");
        cmd.arg("/flushdns");
        let message = run_output(cmd)?;
        return Ok(ActionResult { message });
    }

    #[cfg(not(windows))]
    unreachable!()
}

#[tauri::command]
pub fn restart_explorer() -> Result<ActionResult, String> {
    windows_only()?;

    #[cfg(windows)]
    {
        let _ = Command::new("taskkill")
            .args(["/IM", "explorer.exe", "/F"])
            .output();

        Command::new("cmd")
            .args(["/C", "start", "explorer.exe"])
            .spawn()
            .map_err(|error| format!("Falha ao reiniciar Explorer: {error}"))?;

        return Ok(ActionResult {
            message: "Explorer reiniciado.".to_string(),
        });
    }

    #[cfg(not(windows))]
    unreachable!()
}

#[tauri::command]
pub fn list_local_ips() -> Result<Vec<LocalIpInfo>, String> {
    windows_only()?;

    #[cfg(windows)]
    {
        let output = Command::new("ipconfig")
            .output()
            .map_err(|error| format!("Falha ao executar ipconfig: {error}"))?;

        let text = String::from_utf8_lossy(&output.stdout);
        let mut adapters = Vec::new();
        let mut current_name = String::from("Adaptador");

        for line in text.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            if !trimmed.starts_with(" ") && trimmed.ends_with(':') && !trimmed.contains("IPv") {
                current_name = trimmed.trim_end_matches(':').to_string();
                continue;
            }

            let lower = trimmed.to_lowercase();
            if lower.starts_with("endereço ipv4")
                || lower.starts_with("ipv4 address")
                || lower.starts_with("endereco ipv4")
            {
                if let Some((_, addr)) = trimmed.split_once(':') {
                    let addr = addr.trim();
                    if !addr.is_empty() && addr != "0.0.0.0" {
                        adapters.push(LocalIpInfo {
                            name: current_name.clone(),
                            address: addr.to_string(),
                        });
                    }
                }
            }
        }

        if adapters.is_empty() {
            return Err("Nenhum endereço IPv4 encontrado.".into());
        }

        return Ok(adapters);
    }

    #[cfg(not(windows))]
    unreachable!()
}

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<ActionResult, String> {
    windows_only()?;

    let text = text.trim();
    if text.is_empty() {
        return Err("Nada para copiar.".into());
    }

    #[cfg(windows)]
    {
        let escaped = text.replace('\'', "''");
        let script = format!("Set-Clipboard -Value '{escaped}'");
        let mut cmd = Command::new("powershell");
        cmd.args(["-NoProfile", "-Command", &script]);
        run_output(cmd)?;

        return Ok(ActionResult {
            message: "Copiado para a área de transferência.".to_string(),
        });
    }

    #[cfg(not(windows))]
    unreachable!()
}

#[tauri::command]
pub fn open_system_tool(tool: String) -> Result<ActionResult, String> {
    windows_only()?;

    #[cfg(windows)]
    {
        let tool = tool.trim().to_lowercase();
        match tool.as_str() {
            "taskmgr" => {
                Command::new("taskmgr")
                    .spawn()
                    .map_err(|e| format!("Falha ao abrir Gerenciador de Tarefas: {e}"))?;
                Ok(ActionResult {
                    message: "Gerenciador de Tarefas aberto.".to_string(),
                })
            }
            "hosts" => {
                let system_root = env::var("SystemRoot")
                    .map_err(|_| "SystemRoot não encontrado.".to_string())?;
                let hosts = PathBuf::from(system_root)
                    .join("System32")
                    .join("drivers")
                    .join("etc")
                    .join("hosts");
                Command::new("notepad")
                    .arg(&hosts)
                    .spawn()
                    .map_err(|e| format!("Falha ao abrir hosts: {e}"))?;
                Ok(ActionResult {
                    message: "Arquivo hosts aberto no Bloco de Notas.".to_string(),
                })
            }
            "env" => {
                Command::new("rundll32")
                    .args(["sysdm.cpl,EditEnvironmentVariables"])
                    .spawn()
                    .map_err(|e| format!("Falha ao abrir variáveis de ambiente: {e}"))?;
                Ok(ActionResult {
                    message: "Variáveis de ambiente abertas.".to_string(),
                })
            }
            "services" => {
                Command::new("services.msc")
                    .spawn()
                    .map_err(|e| format!("Falha ao abrir Serviços: {e}"))?;
                Ok(ActionResult {
                    message: "Serviços do Windows abertos.".to_string(),
                })
            }
            _ => Err(format!("Ferramenta desconhecida: {tool}")),
        }
    }

    #[cfg(not(windows))]
    unreachable!()
}
