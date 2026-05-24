use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    pub app_id: String,
    pub name: String,
    pub winget_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallProgress {
    pub app_id: String,
    pub name: String,
    pub status: String,
    pub message: String,
    pub index: usize,
    pub total: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallJobResult {
    pub app_id: String,
    pub name: String,
    pub winget_id: String,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallBatchResult {
    pub jobs: Vec<InstallJobResult>,
    pub winget_available: bool,
}

fn winget_available() -> bool {
    Command::new("winget")
        .arg("--version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn run_winget_install(winget_id: &str) -> Result<String, String> {
    let output = Command::new("winget")
        .args([
            "install",
            "--id",
            winget_id,
            "--exact",
            "--silent",
            "--accept-package-agreements",
            "--accept-source-agreements",
            "--disable-interactivity",
        ])
        .output()
        .map_err(|error| format!("Falha ao executar winget: {error}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{stdout}\n{stderr}").trim().to_string();

  if output.status.success() {
        return Ok(if combined.is_empty() {
            "Instalado com sucesso".to_string()
        } else {
            combined
        });
    }

    let lower = combined.to_lowercase();
    if lower.contains("already installed")
        || lower.contains("já instalado")
        || lower.contains("no available upgrade")
        || lower.contains("nenhuma atualização disponível")
        || lower.contains("no updates available")
    {
        return Ok("Já instalado / atualizado".to_string());
    }

    Err(if combined.is_empty() {
        format!("winget saiu com código {}", output.status.code().unwrap_or(-1))
    } else {
        combined
    })
}

#[tauri::command]
pub async fn install_apps(
    app: AppHandle,
    apps: Vec<InstallRequest>,
) -> Result<InstallBatchResult, String> {
    let winget_ok = winget_available();
    if !winget_ok {
        return Err(
            "winget não encontrado. Instale o App Installer da Microsoft Store.".to_string(),
        );
    }

    let total = apps.len();
    let mut jobs = Vec::with_capacity(total);

    for (index, item) in apps.iter().enumerate() {
        let progress = InstallProgress {
            app_id: item.app_id.clone(),
            name: item.name.clone(),
            status: "installing".to_string(),
            message: "Instalando...".to_string(),
            index: index + 1,
            total,
        };
        let _ = app.emit("install-progress", &progress);

        let winget_id = item.winget_id.clone();
        let install_result =
            tauri::async_runtime::spawn_blocking(move || run_winget_install(&winget_id))
                .await
                .map_err(|error| format!("Erro interno: {error}"))?;

        let (status, message) = match install_result {
            Ok(message) => {
                if message.contains("Já instalado") {
                    ("skipped", message)
                } else {
                    ("done", message)
                }
            }
            Err(message) => ("failed", message),
        };

        let job = InstallJobResult {
            app_id: item.app_id.clone(),
            name: item.name.clone(),
            winget_id: item.winget_id.clone(),
            status: status.to_string(),
            message: message.clone(),
        };
        jobs.push(job.clone());

        let progress = InstallProgress {
            app_id: item.app_id.clone(),
            name: item.name.clone(),
            status: status.to_string(),
            message,
            index: index + 1,
            total,
        };
        let _ = app.emit("install-progress", &progress);
    }

    Ok(InstallBatchResult {
        jobs,
        winget_available: winget_ok,
    })
}

#[tauri::command]
pub fn check_winget() -> bool {
    winget_available()
}
