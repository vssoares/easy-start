use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub id: String,
    pub name: String,
    pub display_name: String,
    pub device_name: String,
    pub connection: String,
    pub is_enabled: bool,
    pub is_primary: bool,
    pub x: Option<i32>,
    pub y: Option<i32>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorActionResult {
    pub message: String,
    pub monitors: Vec<MonitorInfo>,
}

#[tauri::command]
pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
    platform::list_monitors()
}

#[tauri::command]
pub fn set_monitor_enabled(
    monitor_id: String,
    enabled: bool,
) -> Result<MonitorActionResult, String> {
    platform::set_monitor_enabled(monitor_id.trim(), enabled)
}

#[tauri::command]
pub fn set_primary_monitor(monitor_id: String) -> Result<MonitorActionResult, String> {
    platform::set_primary_monitor(monitor_id.trim())
}

#[cfg(not(windows))]
mod platform {
    use super::{MonitorActionResult, MonitorInfo};

    pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
        Err("Disponível apenas no Windows.".into())
    }

    pub fn set_monitor_enabled(
        _monitor_id: &str,
        _enabled: bool,
    ) -> Result<MonitorActionResult, String> {
        Err("Disponível apenas no Windows.".into())
    }

    pub fn set_primary_monitor(_monitor_id: &str) -> Result<MonitorActionResult, String> {
        Err("Disponível apenas no Windows.".into())
    }
}

#[cfg(windows)]
mod platform {
    use super::{MonitorActionResult, MonitorInfo};
    use std::collections::HashSet;
    use std::ffi::OsString;
    use std::mem::{size_of, zeroed};
    use std::os::windows::ffi::OsStringExt;
    use std::ptr::{null, null_mut};

    const ERROR_SUCCESS: i32 = 0;
    const ERROR_ACCESS_DENIED: i32 = 5;
    const ERROR_GEN_FAILURE: i32 = 31;
    const ERROR_NOT_SUPPORTED: i32 = 50;
    const ERROR_INVALID_PARAMETER: i32 = 87;
    const ERROR_INSUFFICIENT_BUFFER: i32 = 122;
    const ERROR_BAD_CONFIGURATION: i32 = 1610;

    const QDC_ALL_PATHS: u32 = 0x00000001;
    const QDC_ONLY_ACTIVE_PATHS: u32 = 0x00000002;
    const QDC_VIRTUAL_MODE_AWARE: u32 = 0x00000010;

    const SDC_USE_SUPPLIED_DISPLAY_CONFIG: u32 = 0x00000020;
    const SDC_APPLY: u32 = 0x00000080;
    const SDC_SAVE_TO_DATABASE: u32 = 0x00000200;
    const SDC_ALLOW_CHANGES: u32 = 0x00000400;
    const SDC_TOPOLOGY_SUPPLIED: u32 = 0x00000010;
    const SDC_ALLOW_PATH_ORDER_CHANGES: u32 = 0x00002000;
    const SDC_VIRTUAL_MODE_AWARE: u32 = 0x00008000;
    const SDC_VIRTUAL_REFRESH_RATE_AWARE: u32 = 0x00020000;

    const DISPLAYCONFIG_PATH_ACTIVE: u32 = 0x00000001;
    const DISPLAYCONFIG_PATH_SUPPORT_VIRTUAL_MODE: u32 = 0x00000008;
    const DISPLAYCONFIG_PATH_BOOST_REFRESH_RATE: u32 = 0x00000010;
    const DISPLAYCONFIG_PATH_MODE_IDX_INVALID: u32 = 0xffff_ffff;
    const DISPLAYCONFIG_PATH_SOURCE_MODE_IDX_INVALID: u32 = 0xffff;

    const DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE: u32 = 1;
    const DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME: u32 = 1;
    const DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME: u32 = 2;
    const CCHDEVICENAME: usize = 32;
    const DISPLAYCONFIG_MAX_MONITOR_NAME: usize = 64;
    const DISPLAYCONFIG_MAX_DEVICE_PATH: usize = 128;

    #[repr(C)]
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
    struct Luid {
        low_part: u32,
        high_part: i32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigRational {
        numerator: u32,
        denominator: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct PointL {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct RectL {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfig2DRegion {
        cx: u32,
        cy: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigVideoSignalInfo {
        pixel_rate: u64,
        h_sync_freq: DisplayConfigRational,
        v_sync_freq: DisplayConfigRational,
        active_size: DisplayConfig2DRegion,
        total_size: DisplayConfig2DRegion,
        video_standard: u32,
        scan_line_ordering: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigTargetMode {
        target_video_signal_info: DisplayConfigVideoSignalInfo,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigSourceMode {
        width: u32,
        height: u32,
        pixel_format: u32,
        position: PointL,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigDesktopImageInfo {
        path_source_size: PointL,
        desktop_image_region: RectL,
        desktop_image_clip: RectL,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    union DisplayConfigModeInfoData {
        target_mode: DisplayConfigTargetMode,
        source_mode: DisplayConfigSourceMode,
        desktop_image_info: DisplayConfigDesktopImageInfo,
    }

    #[repr(C)]
    #[derive(Clone, Copy)]
    struct DisplayConfigModeInfo {
        info_type: u32,
        id: u32,
        adapter_id: Luid,
        data: DisplayConfigModeInfoData,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigPathSourceInfo {
        adapter_id: Luid,
        id: u32,
        mode_info_idx: u32,
        status_flags: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigPathTargetInfo {
        adapter_id: Luid,
        id: u32,
        mode_info_idx: u32,
        output_technology: i32,
        rotation: u32,
        scaling: u32,
        refresh_rate: DisplayConfigRational,
        scan_line_ordering: u32,
        target_available: i32,
        status_flags: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigPathInfo {
        source_info: DisplayConfigPathSourceInfo,
        target_info: DisplayConfigPathTargetInfo,
        flags: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigDeviceInfoHeader {
        device_info_type: u32,
        size: u32,
        adapter_id: Luid,
        id: u32,
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigSourceDeviceName {
        header: DisplayConfigDeviceInfoHeader,
        view_gdi_device_name: [u16; CCHDEVICENAME],
    }

    #[repr(C)]
    #[derive(Debug, Clone, Copy)]
    struct DisplayConfigTargetDeviceName {
        header: DisplayConfigDeviceInfoHeader,
        flags: u32,
        output_technology: i32,
        edid_manufacture_id: u16,
        edid_product_code_id: u16,
        connector_instance: u32,
        monitor_friendly_device_name: [u16; DISPLAYCONFIG_MAX_MONITOR_NAME],
        monitor_device_path: [u16; DISPLAYCONFIG_MAX_DEVICE_PATH],
    }

    #[link(name = "user32")]
    extern "system" {
        fn GetDisplayConfigBufferSizes(
            flags: u32,
            num_path_array_elements: *mut u32,
            num_mode_info_array_elements: *mut u32,
        ) -> i32;

        fn QueryDisplayConfig(
            flags: u32,
            num_path_array_elements: *mut u32,
            path_array: *mut DisplayConfigPathInfo,
            num_mode_info_array_elements: *mut u32,
            mode_info_array: *mut DisplayConfigModeInfo,
            current_topology_id: *mut u32,
        ) -> i32;

        fn SetDisplayConfig(
            num_path_array_elements: u32,
            path_array: *const DisplayConfigPathInfo,
            num_mode_info_array_elements: u32,
            mode_info_array: *const DisplayConfigModeInfo,
            flags: u32,
        ) -> i32;

        fn DisplayConfigGetDeviceInfo(request_packet: *mut DisplayConfigDeviceInfoHeader) -> i32;
    }

    pub fn list_monitors() -> Result<Vec<MonitorInfo>, String> {
        let (paths, modes) = query_display_config(QDC_ALL_PATHS | QDC_VIRTUAL_MODE_AWARE)?;
        monitors_from_config(&paths, &modes)
    }

    pub fn set_monitor_enabled(
        monitor_id: &str,
        enabled: bool,
    ) -> Result<MonitorActionResult, String> {
        if monitor_id.is_empty() {
            return Err("Monitor inválido.".into());
        }

        let (paths, modes) = query_display_config(QDC_ALL_PATHS | QDC_VIRTUAL_MODE_AWARE)?;
        let before = monitors_from_config(&paths, &modes)?;
        let current = before
            .iter()
            .find(|monitor| monitor.id == monitor_id)
            .ok_or_else(|| "Monitor não encontrado.".to_string())?;

        if current.is_enabled == enabled {
            return Ok(MonitorActionResult {
                message: if enabled {
                    "Monitor já está ativo.".to_string()
                } else {
                    "Monitor já está desativado.".to_string()
                },
                monitors: before,
            });
        }

        if !enabled
            && current.is_enabled
            && before.iter().filter(|monitor| monitor.is_enabled).count() <= 1
        {
            return Err("Mantenha pelo menos um monitor ativo.".into());
        }

        let mut desired_targets: HashSet<String> = before
            .iter()
            .filter(|monitor| monitor.is_enabled)
            .map(|monitor| monitor.id.clone())
            .collect();

        if enabled {
            desired_targets.insert(monitor_id.to_string());
        } else {
            desired_targets.remove(monitor_id);
        }

        if desired_targets.is_empty() {
            return Err("Mantenha pelo menos um monitor ativo.".into());
        }

        let active_paths = select_active_paths(&paths, &desired_targets)?;
        apply_topology(&active_paths)?;

        if !enabled && current.is_primary {
            if let Some(next) = list_monitors()?
                .into_iter()
                .find(|monitor| monitor.is_enabled)
                .map(|monitor| monitor.id)
            {
                apply_primary(&next)?;
            }
        }

        Ok(MonitorActionResult {
            message: if enabled {
                "Monitor ativado.".to_string()
            } else {
                "Monitor desativado.".to_string()
            },
            monitors: list_monitors()?,
        })
    }

    pub fn set_primary_monitor(monitor_id: &str) -> Result<MonitorActionResult, String> {
        if monitor_id.is_empty() {
            return Err("Monitor inválido.".into());
        }

        let monitors = list_monitors()?;
        let monitor = monitors
            .iter()
            .find(|monitor| monitor.id == monitor_id)
            .ok_or_else(|| "Monitor não encontrado.".to_string())?;

        if !monitor.is_enabled {
            return Err("Ative o monitor antes de defini-lo como principal.".into());
        }

        if monitor.is_primary {
            return Ok(MonitorActionResult {
                message: "Monitor já é o principal.".to_string(),
                monitors,
            });
        }

        apply_primary(monitor_id)?;

        Ok(MonitorActionResult {
            message: "Monitor principal atualizado.".to_string(),
            monitors: list_monitors()?,
        })
    }

    fn query_display_config(
        flags: u32,
    ) -> Result<(Vec<DisplayConfigPathInfo>, Vec<DisplayConfigModeInfo>), String> {
        for _ in 0..3 {
            let mut path_count = 0;
            let mut mode_count = 0;
            let status =
                unsafe { GetDisplayConfigBufferSizes(flags, &mut path_count, &mut mode_count) };

            if status != ERROR_SUCCESS {
                return Err(format_windows_error("GetDisplayConfigBufferSizes", status));
            }

            let mut paths = vec![unsafe { zeroed::<DisplayConfigPathInfo>() }; path_count as usize];
            let mut modes = vec![unsafe { zeroed::<DisplayConfigModeInfo>() }; mode_count as usize];

            let status = unsafe {
                QueryDisplayConfig(
                    flags,
                    &mut path_count,
                    paths.as_mut_ptr(),
                    &mut mode_count,
                    modes.as_mut_ptr(),
                    null_mut(),
                )
            };

            if status == ERROR_SUCCESS {
                paths.truncate(path_count as usize);
                modes.truncate(mode_count as usize);
                return Ok((paths, modes));
            }

            if status != ERROR_INSUFFICIENT_BUFFER {
                return Err(format_windows_error("QueryDisplayConfig", status));
            }
        }

        Err(
            "A configuração de monitores mudou durante a leitura. Tente atualizar novamente."
                .into(),
        )
    }

    fn monitors_from_config(
        paths: &[DisplayConfigPathInfo],
        modes: &[DisplayConfigModeInfo],
    ) -> Result<Vec<MonitorInfo>, String> {
        let mut seen = HashSet::new();
        let mut monitors = Vec::new();

        for path in paths {
            if !path_is_active(path) && path.target_info.target_available == 0 {
                continue;
            }

            let id = monitor_id(path);
            if !seen.insert(id.clone()) {
                continue;
            }

            let target_name = target_device_name(path);
            let display_name = source_device_name(path);
            let source_mode = if path_is_active(path) {
                source_mode_for_path(path, modes)
            } else {
                None
            };

            let name = if !target_name.0.is_empty() {
                target_name.0.clone()
            } else if !display_name.is_empty() {
                display_name.clone()
            } else {
                format!("Monitor {}", monitors.len() + 1)
            };

            monitors.push(MonitorInfo {
                id,
                name,
                display_name,
                device_name: target_name.1,
                connection: output_technology_label(path.target_info.output_technology),
                is_enabled: path_is_active(path),
                is_primary: source_mode
                    .map(|mode| mode.position.x == 0 && mode.position.y == 0)
                    .unwrap_or(false),
                x: source_mode.map(|mode| mode.position.x),
                y: source_mode.map(|mode| mode.position.y),
                width: source_mode.map(|mode| mode.width),
                height: source_mode.map(|mode| mode.height),
            });
        }

        if !monitors.iter().any(|monitor| monitor.is_primary) {
            if let Some(first_active) = monitors.iter_mut().find(|monitor| monitor.is_enabled) {
                first_active.is_primary = true;
            }
        }

        Ok(monitors)
    }

    fn select_active_paths(
        paths: &[DisplayConfigPathInfo],
        desired_targets: &HashSet<String>,
    ) -> Result<Vec<DisplayConfigPathInfo>, String> {
        let mut selected = Vec::new();
        let mut used_targets = HashSet::new();
        let mut used_sources = HashSet::new();

        for path in paths.iter().filter(|path| path_is_active(path)) {
            let id = monitor_id(path);
            if desired_targets.contains(&id) && used_targets.insert(id) {
                used_sources.insert(source_id(path));
                selected.push(prepared_active_path(*path));
            }
        }

        for path in paths
            .iter()
            .filter(|path| path.target_info.target_available != 0)
        {
            let id = monitor_id(path);
            let source = source_id(path);
            if desired_targets.contains(&id)
                && !used_targets.contains(&id)
                && !used_sources.contains(&source)
            {
                used_targets.insert(id);
                used_sources.insert(source);
                selected.push(prepared_active_path(*path));
            }
        }

        for path in paths
            .iter()
            .filter(|path| path.target_info.target_available != 0)
        {
            let id = monitor_id(path);
            if desired_targets.contains(&id) && !used_targets.contains(&id) {
                used_targets.insert(id);
                used_sources.insert(source_id(path));
                selected.push(prepared_active_path(*path));
            }
        }

        if selected.len() != desired_targets.len() {
            return Err(
                "Não foi possível montar uma configuração válida para esses monitores.".into(),
            );
        }

        Ok(selected)
    }

    fn prepared_active_path(mut path: DisplayConfigPathInfo) -> DisplayConfigPathInfo {
        path.source_info.mode_info_idx = DISPLAYCONFIG_PATH_MODE_IDX_INVALID;
        path.target_info.mode_info_idx = DISPLAYCONFIG_PATH_MODE_IDX_INVALID;
        path.flags = DISPLAYCONFIG_PATH_ACTIVE
            | (path.flags & DISPLAYCONFIG_PATH_SUPPORT_VIRTUAL_MODE)
            | (path.flags & DISPLAYCONFIG_PATH_BOOST_REFRESH_RATE);
        path
    }

    fn apply_topology(paths: &[DisplayConfigPathInfo]) -> Result<(), String> {
        let awareness_flags = sdc_awareness_flags(paths);
        let status = unsafe {
            SetDisplayConfig(
                paths.len() as u32,
                paths.as_ptr(),
                0,
                null(),
                SDC_APPLY | SDC_TOPOLOGY_SUPPLIED | SDC_ALLOW_PATH_ORDER_CHANGES | awareness_flags,
            )
        };

        if status == ERROR_SUCCESS {
            return Ok(());
        }

        let status = unsafe {
            SetDisplayConfig(
                paths.len() as u32,
                paths.as_ptr(),
                0,
                null(),
                SDC_APPLY
                    | SDC_USE_SUPPLIED_DISPLAY_CONFIG
                    | SDC_SAVE_TO_DATABASE
                    | SDC_ALLOW_CHANGES
                    | awareness_flags,
            )
        };

        if status == ERROR_SUCCESS {
            Ok(())
        } else {
            Err(format_windows_error("SetDisplayConfig", status))
        }
    }

    fn apply_primary(selected_monitor_id: &str) -> Result<(), String> {
        let (paths, mut modes) =
            query_display_config(QDC_ONLY_ACTIVE_PATHS | QDC_VIRTUAL_MODE_AWARE)?;
        let awareness_flags = sdc_awareness_flags(&paths);
        let path = paths
            .iter()
            .find(|path| monitor_id(path) == selected_monitor_id)
            .ok_or_else(|| "Monitor ativo não encontrado.".to_string())?;
        let source_index = source_mode_index(path)
            .ok_or_else(|| "Não foi possível identificar a área do monitor.".to_string())?;

        if source_index >= modes.len()
            || modes[source_index].info_type != DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE
        {
            return Err("Não foi possível identificar a área do monitor.".into());
        }

        let selected_mode = unsafe { modes[source_index].data.source_mode };
        let offset_x = selected_mode.position.x;
        let offset_y = selected_mode.position.y;

        for mode in &mut modes {
            if mode.info_type == DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE {
                let source = unsafe { &mut mode.data.source_mode };
                source.position.x -= offset_x;
                source.position.y -= offset_y;
            }
        }

        let status = unsafe {
            SetDisplayConfig(
                paths.len() as u32,
                paths.as_ptr(),
                modes.len() as u32,
                modes.as_ptr(),
                SDC_APPLY
                    | SDC_USE_SUPPLIED_DISPLAY_CONFIG
                    | SDC_SAVE_TO_DATABASE
                    | SDC_ALLOW_CHANGES
                    | awareness_flags,
            )
        };

        if status == ERROR_SUCCESS {
            Ok(())
        } else {
            Err(format_windows_error("SetDisplayConfig", status))
        }
    }

    fn path_is_active(path: &DisplayConfigPathInfo) -> bool {
        path.flags & DISPLAYCONFIG_PATH_ACTIVE != 0
    }

    fn sdc_awareness_flags(paths: &[DisplayConfigPathInfo]) -> u32 {
        let mut flags = 0;

        if paths
            .iter()
            .any(|path| path.flags & DISPLAYCONFIG_PATH_SUPPORT_VIRTUAL_MODE != 0)
        {
            flags |= SDC_VIRTUAL_MODE_AWARE;
        }

        if paths
            .iter()
            .any(|path| path.flags & DISPLAYCONFIG_PATH_BOOST_REFRESH_RATE != 0)
        {
            flags |= SDC_VIRTUAL_REFRESH_RATE_AWARE;
        }

        flags
    }

    fn monitor_id(path: &DisplayConfigPathInfo) -> String {
        format!(
            "{}:{}:{}",
            path.target_info.adapter_id.low_part,
            path.target_info.adapter_id.high_part,
            path.target_info.id
        )
    }

    fn source_id(path: &DisplayConfigPathInfo) -> String {
        format!(
            "{}:{}:{}",
            path.source_info.adapter_id.low_part,
            path.source_info.adapter_id.high_part,
            path.source_info.id
        )
    }

    fn source_mode_for_path(
        path: &DisplayConfigPathInfo,
        modes: &[DisplayConfigModeInfo],
    ) -> Option<DisplayConfigSourceMode> {
        let index = source_mode_index(path)?;
        let mode = modes.get(index)?;

        if mode.info_type != DISPLAYCONFIG_MODE_INFO_TYPE_SOURCE {
            return None;
        }

        Some(unsafe { mode.data.source_mode })
    }

    fn source_mode_index(path: &DisplayConfigPathInfo) -> Option<usize> {
        if path.flags & DISPLAYCONFIG_PATH_SUPPORT_VIRTUAL_MODE != 0 {
            let index = (path.source_info.mode_info_idx >> 16) & 0xffff;
            if index == DISPLAYCONFIG_PATH_SOURCE_MODE_IDX_INVALID {
                None
            } else {
                Some(index as usize)
            }
        } else if path.source_info.mode_info_idx == DISPLAYCONFIG_PATH_MODE_IDX_INVALID {
            None
        } else {
            Some(path.source_info.mode_info_idx as usize)
        }
    }

    fn source_device_name(path: &DisplayConfigPathInfo) -> String {
        let mut source_name = unsafe { zeroed::<DisplayConfigSourceDeviceName>() };
        source_name.header.device_info_type = DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME;
        source_name.header.size = size_of::<DisplayConfigSourceDeviceName>() as u32;
        source_name.header.adapter_id = path.source_info.adapter_id;
        source_name.header.id = path.source_info.id;

        let status = unsafe {
            DisplayConfigGetDeviceInfo(
                &mut source_name as *mut DisplayConfigSourceDeviceName
                    as *mut DisplayConfigDeviceInfoHeader,
            )
        };
        if status == ERROR_SUCCESS {
            utf16_to_string(&source_name.view_gdi_device_name)
        } else {
            String::new()
        }
    }

    fn target_device_name(path: &DisplayConfigPathInfo) -> (String, String) {
        let mut target_name = unsafe { zeroed::<DisplayConfigTargetDeviceName>() };
        target_name.header.device_info_type = DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME;
        target_name.header.size = size_of::<DisplayConfigTargetDeviceName>() as u32;
        target_name.header.adapter_id = path.target_info.adapter_id;
        target_name.header.id = path.target_info.id;

        let status = unsafe {
            DisplayConfigGetDeviceInfo(
                &mut target_name as *mut DisplayConfigTargetDeviceName
                    as *mut DisplayConfigDeviceInfoHeader,
            )
        };
        if status == ERROR_SUCCESS {
            (
                utf16_to_string(&target_name.monitor_friendly_device_name),
                utf16_to_string(&target_name.monitor_device_path),
            )
        } else {
            (String::new(), String::new())
        }
    }

    fn utf16_to_string(buffer: &[u16]) -> String {
        let len = buffer
            .iter()
            .position(|character| *character == 0)
            .unwrap_or(buffer.len());

        OsString::from_wide(&buffer[..len])
            .to_string_lossy()
            .trim()
            .to_string()
    }

    fn output_technology_label(value: i32) -> String {
        match value {
            0 => "VGA".to_string(),
            4 => "DVI".to_string(),
            5 => "HDMI".to_string(),
            6 => "Interno".to_string(),
            10 => "DisplayPort".to_string(),
            11 => "DisplayPort interno".to_string(),
            12 => "UDI".to_string(),
            13 => "UDI interno".to_string(),
            14 => "Dongle SDTV".to_string(),
            15 => "Miracast".to_string(),
            16 => "Indireto".to_string(),
            17 => "Virtual".to_string(),
            18 => "DisplayPort USB".to_string(),
            -1 => "Outro".to_string(),
            -2147483648 => "Interno".to_string(),
            _ => format!("Conexão {value}"),
        }
    }

    fn format_windows_error(action: &str, code: i32) -> String {
        match code {
            ERROR_ACCESS_DENIED => {
                "Sem acesso à sessão de console para alterar monitores.".to_string()
            }
            ERROR_GEN_FAILURE => {
                "O Windows não conseguiu aplicar a configuração de monitores.".to_string()
            }
            ERROR_NOT_SUPPORTED => {
                "Configuração de monitores não suportada neste ambiente.".to_string()
            }
            ERROR_INVALID_PARAMETER => "Parâmetro inválido ao configurar monitores.".to_string(),
            ERROR_INSUFFICIENT_BUFFER => {
                "A configuração de monitores mudou durante a operação.".to_string()
            }
            ERROR_BAD_CONFIGURATION => {
                "O Windows não encontrou uma configuração válida para esses monitores.".to_string()
            }
            _ => format!("{action} falhou com código {code}."),
        }
    }
}
