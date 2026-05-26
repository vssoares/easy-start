mod install;
mod nvm;
mod port;
mod quick_tools;

use install::{check_winget, install_apps};
use nvm::{
    ensure_nvm, install_node_version, list_node_versions, node_manager_supported, nvm_status,
    uninstall_node_version, use_node_version,
};
use port::{inspect_port, kill_port};
use quick_tools::{
    copy_to_clipboard, flush_dns, list_local_ips, open_special_folder, open_system_tool,
    restart_explorer,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            install_apps,
            check_winget,
            nvm_status,
            ensure_nvm,
            list_node_versions,
            install_node_version,
            uninstall_node_version,
            use_node_version,
            node_manager_supported,
            kill_port,
            inspect_port,
            open_special_folder,
            flush_dns,
            restart_explorer,
            list_local_ips,
            copy_to_clipboard,
            open_system_tool,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
