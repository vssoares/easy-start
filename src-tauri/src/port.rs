use serde::Serialize;
use std::collections::HashSet;
use std::process::Command;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortProcessInfo {
    pub pid: u32,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectPortResult {
    pub port: u16,
    pub processes: Vec<PortProcessInfo>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KillPortResult {
    pub port: u16,
    pub pids: Vec<u32>,
    pub killed: Vec<u32>,
    pub message: String,
}

fn local_addr_uses_port(local: &str, port: u16) -> bool {
    local.ends_with(&format!(":{port}")) || local.contains(&format!("]:{port}"))
}

#[cfg(windows)]
pub(crate) fn find_pids_on_port(port: u16) -> Result<Vec<u32>, String> {
    let output = Command::new("netstat")
        .args(["-ano"])
        .output()
        .map_err(|error| format!("Falha ao executar netstat: {error}"))?;

    if !output.status.success() {
        return Err("netstat retornou erro".into());
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut pids = HashSet::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with("TCP") && !trimmed.starts_with("UDP") {
            continue;
        }

        let parts: Vec<&str> = trimmed.split_whitespace().collect();
        if parts.len() < 4 {
            continue;
        }

        let local = parts[1];
        if !local_addr_uses_port(local, port) {
            continue;
        }

        let Some(pid_str) = parts.last() else {
            continue;
        };

        let Ok(pid) = pid_str.parse::<u32>() else {
            continue;
        };

        if pid > 4 {
            pids.insert(pid);
        }
    }

    Ok(pids.into_iter().collect())
}

#[cfg(windows)]
fn kill_pid(pid: u32) -> Result<(), String> {
    let output = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/F"])
        .output()
        .map_err(|error| format!("Falha ao executar taskkill: {error}"))?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let stdout = String::from_utf8_lossy(&output.stdout);
    let detail = format!("{stdout} {stderr}").trim().to_string();

    Err(if detail.is_empty() {
        format!("taskkill falhou para PID {pid}")
    } else {
        detail
    })
}

#[cfg(windows)]
fn process_name_for_pid(pid: u32) -> String {
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/FO", "CSV", "/NH"])
        .output();

    let Ok(output) = output else {
        return format!("PID {pid}");
    };

    let line = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if line.is_empty() || line.starts_with("INFO:") {
        return format!("PID {pid}");
    }

    line.split(',')
        .next()
        .map(|s| s.trim_matches('"').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| format!("PID {pid}"))
}

#[tauri::command]
pub fn inspect_port(port: u16) -> Result<InspectPortResult, String> {
    if port == 0 {
        return Err("Informe uma porta entre 1 e 65535.".into());
    }

    #[cfg(not(windows))]
    {
        let _ = port;
        return Err("Disponível apenas no Windows.".into());
    }

    #[cfg(windows)]
    {
        let pids = find_pids_on_port(port)?;
        let processes: Vec<PortProcessInfo> = pids
            .iter()
            .map(|pid| PortProcessInfo {
                pid: *pid,
                name: process_name_for_pid(*pid),
            })
            .collect();

        let message = if processes.is_empty() {
            format!("Nenhum processo na porta {port}.")
        } else {
            let list = processes
                .iter()
                .map(|p| format!("{} ({})", p.name, p.pid))
                .collect::<Vec<_>>()
                .join(", ");
            format!("Porta {port}: {list}")
        };

        Ok(InspectPortResult {
            port,
            processes,
            message,
        })
    }
}

#[tauri::command]
pub fn kill_port(port: u16) -> Result<KillPortResult, String> {
    if port == 0 {
        return Err("Informe uma porta entre 1 e 65535.".into());
    }

    #[cfg(not(windows))]
    {
        let _ = port;
        return Err("Encerrar porta só está disponível no Windows.".into());
    }

    #[cfg(windows)]
    {
        let pids = find_pids_on_port(port)?;

        if pids.is_empty() {
            return Ok(KillPortResult {
                port,
                pids: vec![],
                killed: vec![],
                message: format!("Nenhum processo usando a porta {port}."),
            });
        }

        let mut killed = Vec::new();
        let mut errors = Vec::new();

        for pid in &pids {
            match kill_pid(*pid) {
                Ok(()) => killed.push(*pid),
                Err(err) => errors.push(format!("PID {pid}: {err}")),
            }
        }

        let message = if killed.is_empty() {
            format!(
                "Não foi possível encerrar os processos na porta {port}. {}",
                errors.join(" ")
            )
        } else if errors.is_empty() {
            format!(
                "Porta {port} liberada. Processo(s) encerrado(s): {}.",
                killed
                    .iter()
                    .map(|p| p.to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            )
        } else {
            format!(
                "Porta {port}: encerrado(s) {}. Falha em: {}",
                killed
                    .iter()
                    .map(|p| p.to_string())
                    .collect::<Vec<_>>()
                    .join(", "),
                errors.join(" ")
            )
        };

        Ok(KillPortResult {
            port,
            pids,
            killed,
            message,
        })
    }
}
