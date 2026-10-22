param(
  [Parameter(Mandatory = $true)][ValidateSet('list', 'enable', 'disable', 'primary')][string]$Action,
  [string]$Id = ''
)

# Port de monitors.rs: usa a API de configuração de vídeo do Windows (CCD) via P/Invoke.
# Compilado com Add-Type (C# 5 no Windows PowerShell 5.1).

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class MonitorInfo
{
    public string id { get; set; }
    public string name { get; set; }
    public string displayName { get; set; }
    public string deviceName { get; set; }
    public string connection { get; set; }
    public bool isEnabled { get; set; }
    public bool isPrimary { get; set; }
    public int? x { get; set; }
    public int? y { get; set; }
    public uint? width { get; set; }
    public uint? height { get; set; }
}

public class MonitorActionResult
{
    public string message { get; set; }
    public List<MonitorInfo> monitors { get; set; }
}

public class MonitorException : Exception
{
    public MonitorException(string message) : base(message) { }
}

public static class Monitors
{
    const int ERROR_SUCCESS = 0;
    const int ERROR_ACCESS_DENIED = 5;
    const int ERROR_GEN_FAILURE = 31;
    const int ERROR_NOT_SUPPORTED = 50;
    const int ERROR_INVALID_PARAMETER = 87;
    const int ERROR_INSUFFICIENT_BUFFER = 122;
    const int ERROR_BAD_CONFIGURATION = 1610;

    const uint QDC_ALL_PATHS = 0x00000001;
    const uint QDC_ONLY_ACTIVE_PATHS = 0x00000002;
    const uint QDC_VIRTUAL_MODE_AWARE = 0x00000010;

    const uint SDC_USE_SUPPLIED_DISPLAY_CONFIG = 0x00000020;
    const uint SDC_APPLY = 0x00000080;
    const uint SDC_SAVE_TO_DATABASE = 0x00000200;
    const uint SDC_ALLOW_CHANGES = 0x00000400;
    const uint SDC_TOPOLOGY_SUPPLIED = 0x00000010;
    const uint SDC_ALLOW_PATH_ORDER_CHANGES = 0x00002000;
    const uint SDC_VIRTUAL_MODE_AWARE = 0x00008000;
    const uint SDC_VIRTUAL_REFRESH_RATE_AWARE = 0x00020000;

    const uint PATH_ACTIVE = 0x00000001;
    const uint PATH_SUPPORT_VIRTUAL_MODE = 0x00000008;
    const uint PATH_BOOST_REFRESH_RATE = 0x00000010;
    const uint PATH_MODE_IDX_INVALID = 0xffffffff;
    const uint PATH_SOURCE_MODE_IDX_INVALID = 0xffff;

    const uint MODE_INFO_TYPE_SOURCE = 1;
    const uint DEVICE_INFO_GET_SOURCE_NAME = 1;
    const uint DEVICE_INFO_GET_TARGET_NAME = 2;
    const uint MONITOR_DEFAULTTOPRIMARY = 1;
    const uint MONITORINFOF_PRIMARY = 1;

    [StructLayout(LayoutKind.Sequential)]
    struct LUID { public uint LowPart; public int HighPart; }

    [StructLayout(LayoutKind.Sequential)]
    struct RATIONAL { public uint Numerator; public uint Denominator; }

    [StructLayout(LayoutKind.Sequential)]
    struct POINTL { public int x; public int y; }

    [StructLayout(LayoutKind.Sequential)]
    struct RECTL { public int left; public int top; public int right; public int bottom; }

    [StructLayout(LayoutKind.Sequential)]
    struct REGION2D { public uint cx; public uint cy; }

    [StructLayout(LayoutKind.Sequential)]
    struct VIDEO_SIGNAL_INFO
    {
        public ulong pixelRate;
        public RATIONAL hSyncFreq;
        public RATIONAL vSyncFreq;
        public REGION2D activeSize;
        public REGION2D totalSize;
        public uint videoStandard;
        public uint scanLineOrdering;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct SOURCE_MODE { public uint width; public uint height; public uint pixelFormat; public POINTL position; }

    [StructLayout(LayoutKind.Sequential)]
    struct DESKTOP_IMAGE_INFO { public POINTL pathSourceSize; public RECTL desktopImageRegion; public RECTL desktopImageClip; }

    [StructLayout(LayoutKind.Explicit, Size = 64)]
    struct MODE_INFO
    {
        [FieldOffset(0)] public uint infoType;
        [FieldOffset(4)] public uint id;
        [FieldOffset(8)] public LUID adapterId;
        [FieldOffset(16)] public VIDEO_SIGNAL_INFO targetMode;
        [FieldOffset(16)] public SOURCE_MODE sourceMode;
        [FieldOffset(16)] public DESKTOP_IMAGE_INFO desktopImageInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PATH_SOURCE_INFO { public LUID adapterId; public uint id; public uint modeInfoIdx; public uint statusFlags; }

    [StructLayout(LayoutKind.Sequential)]
    struct PATH_TARGET_INFO
    {
        public LUID adapterId;
        public uint id;
        public uint modeInfoIdx;
        public int outputTechnology;
        public uint rotation;
        public uint scaling;
        public RATIONAL refreshRate;
        public uint scanLineOrdering;
        public int targetAvailable;
        public uint statusFlags;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct PATH_INFO { public PATH_SOURCE_INFO sourceInfo; public PATH_TARGET_INFO targetInfo; public uint flags; }

    [StructLayout(LayoutKind.Sequential)]
    struct DEVICE_INFO_HEADER { public uint type; public uint size; public LUID adapterId; public uint id; }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct SOURCE_DEVICE_NAME
    {
        public DEVICE_INFO_HEADER header;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string viewGdiDeviceName;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct TARGET_DEVICE_NAME
    {
        public DEVICE_INFO_HEADER header;
        public uint flags;
        public int outputTechnology;
        public ushort edidManufactureId;
        public ushort edidProductCodeId;
        public uint connectorInstance;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string monitorFriendlyDeviceName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string monitorDevicePath;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct MONITORINFOEX
    {
        public uint cbSize;
        public RECTL rcMonitor;
        public RECTL rcWork;
        public uint dwFlags;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice;
    }

    [DllImport("user32.dll")]
    static extern int GetDisplayConfigBufferSizes(uint flags, out uint numPaths, out uint numModes);

    [DllImport("user32.dll")]
    static extern int QueryDisplayConfig(uint flags, ref uint numPaths, [Out] PATH_INFO[] paths,
        ref uint numModes, [Out] MODE_INFO[] modes, IntPtr currentTopologyId);

    [DllImport("user32.dll")]
    static extern int SetDisplayConfig(uint numPaths, [In] PATH_INFO[] paths, uint numModes,
        [In] MODE_INFO[] modes, uint flags);

    [DllImport("user32.dll", EntryPoint = "DisplayConfigGetDeviceInfo")]
    static extern int DisplayConfigGetSourceName(ref SOURCE_DEVICE_NAME packet);

    [DllImport("user32.dll", EntryPoint = "DisplayConfigGetDeviceInfo")]
    static extern int DisplayConfigGetTargetName(ref TARGET_DEVICE_NAME packet);

    [DllImport("user32.dll")]
    static extern IntPtr MonitorFromPoint(POINTL pt, uint flags);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool GetMonitorInfoW(IntPtr hMonitor, ref MONITORINFOEX info);

    // ---- API pública ----

    public static List<MonitorInfo> List()
    {
        PATH_INFO[] paths; MODE_INFO[] modes;
        Query(QDC_ALL_PATHS | QDC_VIRTUAL_MODE_AWARE, out paths, out modes);
        return MonitorsFromConfig(paths, modes);
    }

    public static MonitorActionResult SetEnabled(string monitorId, bool enabled)
    {
        if (string.IsNullOrEmpty(monitorId)) throw new MonitorException("Monitor inválido.");

        PATH_INFO[] paths; MODE_INFO[] modes;
        Query(QDC_ALL_PATHS | QDC_VIRTUAL_MODE_AWARE, out paths, out modes);
        List<MonitorInfo> before = MonitorsFromConfig(paths, modes);

        MonitorInfo current = before.Find(delegate(MonitorInfo m) { return m.id == monitorId; });
        if (current == null) throw new MonitorException("Monitor não encontrado.");

        if (current.isEnabled == enabled)
        {
            return new MonitorActionResult
            {
                message = enabled ? "Monitor já está ativo." : "Monitor já está desativado.",
                monitors = before
            };
        }

        int enabledCount = before.FindAll(delegate(MonitorInfo m) { return m.isEnabled; }).Count;
        if (!enabled && current.isEnabled && enabledCount <= 1)
            throw new MonitorException("Mantenha pelo menos um monitor ativo.");

        HashSet<string> desired = new HashSet<string>();
        foreach (MonitorInfo m in before) { if (m.isEnabled) desired.Add(m.id); }
        if (enabled) desired.Add(monitorId); else desired.Remove(monitorId);
        if (desired.Count == 0) throw new MonitorException("Mantenha pelo menos um monitor ativo.");

        // O Windows exige um monitor em (0,0) antes de desativar o principal.
        if (!enabled && current.isPrimary)
        {
            string nextId = PickPrimaryCandidate(before, monitorId);
            if (nextId != null)
            {
                ApplyPrimary(nextId);
                MODE_INFO[] ignored;
                Query(QDC_ALL_PATHS | QDC_VIRTUAL_MODE_AWARE, out paths, out ignored);
            }
        }

        ApplyTopology(SelectActivePaths(paths, desired));

        return new MonitorActionResult
        {
            message = enabled ? "Monitor ativado." : "Monitor desativado.",
            monitors = List()
        };
    }

    public static MonitorActionResult SetPrimary(string monitorId)
    {
        if (string.IsNullOrEmpty(monitorId)) throw new MonitorException("Monitor inválido.");

        List<MonitorInfo> monitors = List();
        MonitorInfo monitor = monitors.Find(delegate(MonitorInfo m) { return m.id == monitorId; });
        if (monitor == null) throw new MonitorException("Monitor não encontrado.");
        if (!monitor.isEnabled) throw new MonitorException("Ative o monitor antes de defini-lo como principal.");

        if (monitor.isPrimary)
            return new MonitorActionResult { message = "Monitor já é o principal.", monitors = monitors };

        ApplyPrimary(monitorId);

        return new MonitorActionResult { message = "Monitor principal atualizado.", monitors = List() };
    }

    // ---- Consulta ----

    static void Query(uint flags, out PATH_INFO[] paths, out MODE_INFO[] modes)
    {
        for (int attempt = 0; attempt < 3; attempt++)
        {
            uint pathCount, modeCount;
            int status = GetDisplayConfigBufferSizes(flags, out pathCount, out modeCount);
            if (status != ERROR_SUCCESS) throw new MonitorException(FormatError("GetDisplayConfigBufferSizes", status));

            paths = new PATH_INFO[pathCount];
            modes = new MODE_INFO[modeCount];

            status = QueryDisplayConfig(flags, ref pathCount, paths, ref modeCount, modes, IntPtr.Zero);
            if (status == ERROR_SUCCESS)
            {
                Array.Resize(ref paths, (int)pathCount);
                Array.Resize(ref modes, (int)modeCount);
                return;
            }
            if (status != ERROR_INSUFFICIENT_BUFFER) throw new MonitorException(FormatError("QueryDisplayConfig", status));
        }

        throw new MonitorException("A configuração de monitores mudou durante a leitura. Tente atualizar novamente.");
    }

    static List<MonitorInfo> MonitorsFromConfig(PATH_INFO[] paths, MODE_INFO[] modes)
    {
        HashSet<string> seen = new HashSet<string>();
        List<MonitorInfo> monitors = new List<MonitorInfo>();

        foreach (PATH_INFO path in paths)
        {
            if (!PathIsActive(path) && path.targetInfo.targetAvailable == 0) continue;

            string id = MonitorId(path);
            if (!seen.Add(id)) continue;

            string targetName, devicePath;
            TargetDeviceName(path, out targetName, out devicePath);
            string displayName = SourceDeviceName(path);

            SOURCE_MODE? sourceMode = PathIsActive(path) ? SourceModeForPath(path, modes) : null;

            string name = targetName.Length > 0 ? targetName
                : displayName.Length > 0 ? displayName
                : "Monitor " + (monitors.Count + 1);

            MonitorInfo info = new MonitorInfo();
            info.id = id;
            info.name = name;
            info.displayName = displayName;
            info.deviceName = devicePath;
            info.connection = OutputTechnologyLabel(path.targetInfo.outputTechnology);
            info.isEnabled = PathIsActive(path);
            info.isPrimary = false;
            if (sourceMode.HasValue)
            {
                info.x = sourceMode.Value.position.x;
                info.y = sourceMode.Value.position.y;
                info.width = sourceMode.Value.width;
                info.height = sourceMode.Value.height;
            }
            monitors.Add(info);
        }

        AssignPrimaryMonitor(monitors);
        return monitors;
    }

    // Garante um único monitor principal (evita dois em (0,0) no modo duplicado).
    static void AssignPrimaryMonitor(List<MonitorInfo> monitors)
    {
        foreach (MonitorInfo m in monitors) m.isPrimary = false;

        string primaryDevice = PrimaryGdiDeviceName();
        int index = -1;

        if (primaryDevice != null)
        {
            index = monitors.FindIndex(delegate(MonitorInfo m)
            {
                return m.isEnabled && GdiDevicesMatch(m.displayName, primaryDevice);
            });
        }

        if (index < 0)
        {
            string candidate = PickPrimaryCandidate(monitors, null);
            if (candidate != null) index = monitors.FindIndex(delegate(MonitorInfo m) { return m.id == candidate; });
        }

        if (index >= 0) monitors[index].isPrimary = true;
    }

    static string PickPrimaryCandidate(List<MonitorInfo> monitors, string excludeId)
    {
        List<MonitorInfo> candidates = monitors.FindAll(delegate(MonitorInfo m)
        {
            return m.isEnabled && (excludeId == null || m.id != excludeId);
        });
        if (candidates.Count == 0) return null;

        string device = PrimaryGdiDeviceName();
        if (device != null)
        {
            foreach (MonitorInfo m in candidates)
                if (GdiDevicesMatch(m.displayName, device)) return m.id;
        }

        MonitorInfo best = null;
        foreach (MonitorInfo m in candidates)
        {
            if (!m.x.HasValue || !m.y.HasValue) continue;
            if (best == null || m.x.Value < best.x.Value || (m.x.Value == best.x.Value && m.y.Value < best.y.Value))
                best = m;
        }

        return (best ?? candidates[0]).id;
    }

    static string PrimaryGdiDeviceName()
    {
        POINTL origin = new POINTL();
        IntPtr hMonitor = MonitorFromPoint(origin, MONITOR_DEFAULTTOPRIMARY);
        if (hMonitor == IntPtr.Zero) return null;

        MONITORINFOEX info = new MONITORINFOEX();
        info.cbSize = (uint)Marshal.SizeOf(typeof(MONITORINFOEX));
        if (!GetMonitorInfoW(hMonitor, ref info)) return null;
        if ((info.dwFlags & MONITORINFOF_PRIMARY) == 0) return null;

        string device = (info.szDevice ?? "").Trim();
        return device.Length == 0 ? null : device;
    }

    static bool GdiDevicesMatch(string left, string right)
    {
        string l = NormalizeGdi(left), r = NormalizeGdi(right);
        return l == r || l.EndsWith(r) || r.EndsWith(l);
    }

    static string NormalizeGdi(string value)
    {
        string v = (value ?? "").Trim();
        if (v.StartsWith("\\\\.\\")) v = v.Substring(4);
        return v.ToUpperInvariant();
    }

    // ---- Aplicação ----

    static List<PATH_INFO> SelectActivePaths(PATH_INFO[] paths, HashSet<string> desired)
    {
        List<PATH_INFO> selected = new List<PATH_INFO>();
        HashSet<string> usedTargets = new HashSet<string>();
        HashSet<string> usedSources = new HashSet<string>();

        foreach (PATH_INFO path in paths)
        {
            if (!PathIsActive(path)) continue;
            string id = MonitorId(path);
            if (desired.Contains(id) && usedTargets.Add(id))
            {
                usedSources.Add(SourceId(path));
                selected.Add(PreparedActivePath(path));
            }
        }

        foreach (PATH_INFO path in paths)
        {
            if (path.targetInfo.targetAvailable == 0) continue;
            string id = MonitorId(path), source = SourceId(path);
            if (desired.Contains(id) && !usedTargets.Contains(id) && !usedSources.Contains(source))
            {
                usedTargets.Add(id);
                usedSources.Add(source);
                selected.Add(PreparedActivePath(path));
            }
        }

        foreach (PATH_INFO path in paths)
        {
            if (path.targetInfo.targetAvailable == 0) continue;
            string id = MonitorId(path);
            if (desired.Contains(id) && !usedTargets.Contains(id))
            {
                usedTargets.Add(id);
                usedSources.Add(SourceId(path));
                selected.Add(PreparedActivePath(path));
            }
        }

        if (selected.Count != desired.Count)
            throw new MonitorException("Não foi possível montar uma configuração válida para esses monitores.");

        return selected;
    }

    static PATH_INFO PreparedActivePath(PATH_INFO path)
    {
        path.sourceInfo.modeInfoIdx = PATH_MODE_IDX_INVALID;
        path.targetInfo.modeInfoIdx = PATH_MODE_IDX_INVALID;
        path.flags = PATH_ACTIVE
            | (path.flags & PATH_SUPPORT_VIRTUAL_MODE)
            | (path.flags & PATH_BOOST_REFRESH_RATE);
        return path;
    }

    static void ApplyTopology(List<PATH_INFO> selected)
    {
        PATH_INFO[] paths = selected.ToArray();
        uint awareness = SdcAwarenessFlags(paths);
        uint topologyFlags = SDC_APPLY | SDC_TOPOLOGY_SUPPLIED | SDC_ALLOW_PATH_ORDER_CHANGES | awareness;

        int status = SetDisplayConfig((uint)paths.Length, paths, 0, null, topologyFlags);
        if (status == ERROR_SUCCESS) return;

        if (status != ERROR_INVALID_PARAMETER && status != ERROR_BAD_CONFIGURATION)
            throw new MonitorException(FormatError("SetDisplayConfig", status));

        PATH_INFO[] allPaths; MODE_INFO[] allModes;
        Query(QDC_ALL_PATHS | QDC_VIRTUAL_MODE_AWARE, out allPaths, out allModes);

        HashSet<string> selectedIds = new HashSet<string>();
        foreach (PATH_INFO p in paths) selectedIds.Add(MonitorId(p));

        List<PATH_INFO> filtered = new List<PATH_INFO>();
        foreach (PATH_INFO p in allPaths)
            if (selectedIds.Contains(MonitorId(p))) filtered.Add(PreparedActivePath(p));

        if (filtered.Count == 0) throw new MonitorException(FormatError("SetDisplayConfig", status));

        uint configFlags = SDC_APPLY | SDC_USE_SUPPLIED_DISPLAY_CONFIG | SDC_SAVE_TO_DATABASE
            | SDC_ALLOW_CHANGES | awareness;

        status = SetDisplayConfig((uint)filtered.Count, filtered.ToArray(), (uint)allModes.Length, allModes, configFlags);
        if (status != ERROR_SUCCESS) throw new MonitorException(FormatError("SetDisplayConfig", status));
    }

    static void ApplyPrimary(string selectedMonitorId)
    {
        PATH_INFO[] paths; MODE_INFO[] modes;
        Query(QDC_ONLY_ACTIVE_PATHS | QDC_VIRTUAL_MODE_AWARE, out paths, out modes);
        uint awareness = SdcAwarenessFlags(paths);

        int pathIndex = Array.FindIndex(paths, delegate(PATH_INFO p) { return MonitorId(p) == selectedMonitorId; });
        if (pathIndex < 0) throw new MonitorException("Monitor ativo não encontrado.");

        int sourceIndex = SourceModeIndex(paths[pathIndex]);
        if (sourceIndex < 0 || sourceIndex >= modes.Length || modes[sourceIndex].infoType != MODE_INFO_TYPE_SOURCE)
            throw new MonitorException("Não foi possível identificar a área do monitor.");

        int offsetX = modes[sourceIndex].sourceMode.position.x;
        int offsetY = modes[sourceIndex].sourceMode.position.y;

        for (int i = 0; i < modes.Length; i++)
        {
            if (modes[i].infoType != MODE_INFO_TYPE_SOURCE) continue;
            SOURCE_MODE source = modes[i].sourceMode;
            source.position.x -= offsetX;
            source.position.y -= offsetY;
            modes[i].sourceMode = source;
        }

        int status = SetDisplayConfig((uint)paths.Length, paths, (uint)modes.Length, modes,
            SDC_APPLY | SDC_USE_SUPPLIED_DISPLAY_CONFIG | SDC_SAVE_TO_DATABASE | SDC_ALLOW_CHANGES | awareness);
        if (status != ERROR_SUCCESS) throw new MonitorException(FormatError("SetDisplayConfig", status));
    }

    // ---- Auxiliares ----

    static bool PathIsActive(PATH_INFO path) { return (path.flags & PATH_ACTIVE) != 0; }

    static uint SdcAwarenessFlags(PATH_INFO[] paths)
    {
        uint flags = 0;
        foreach (PATH_INFO p in paths)
        {
            if ((p.flags & PATH_SUPPORT_VIRTUAL_MODE) != 0) flags |= SDC_VIRTUAL_MODE_AWARE;
            if ((p.flags & PATH_BOOST_REFRESH_RATE) != 0) flags |= SDC_VIRTUAL_REFRESH_RATE_AWARE;
        }
        return flags;
    }

    static string MonitorId(PATH_INFO p)
    {
        return p.targetInfo.adapterId.LowPart + ":" + p.targetInfo.adapterId.HighPart + ":" + p.targetInfo.id;
    }

    static string SourceId(PATH_INFO p)
    {
        return p.sourceInfo.adapterId.LowPart + ":" + p.sourceInfo.adapterId.HighPart + ":" + p.sourceInfo.id;
    }

    static SOURCE_MODE? SourceModeForPath(PATH_INFO path, MODE_INFO[] modes)
    {
        int index = SourceModeIndex(path);
        if (index < 0 || index >= modes.Length) return null;
        if (modes[index].infoType != MODE_INFO_TYPE_SOURCE) return null;
        return modes[index].sourceMode;
    }

    static int SourceModeIndex(PATH_INFO path)
    {
        if ((path.flags & PATH_SUPPORT_VIRTUAL_MODE) != 0)
        {
            uint index = (path.sourceInfo.modeInfoIdx >> 16) & 0xffff;
            return index == PATH_SOURCE_MODE_IDX_INVALID ? -1 : (int)index;
        }
        return path.sourceInfo.modeInfoIdx == PATH_MODE_IDX_INVALID ? -1 : (int)path.sourceInfo.modeInfoIdx;
    }

    static string SourceDeviceName(PATH_INFO path)
    {
        SOURCE_DEVICE_NAME name = new SOURCE_DEVICE_NAME();
        name.header.type = DEVICE_INFO_GET_SOURCE_NAME;
        name.header.size = (uint)Marshal.SizeOf(typeof(SOURCE_DEVICE_NAME));
        name.header.adapterId = path.sourceInfo.adapterId;
        name.header.id = path.sourceInfo.id;

        return DisplayConfigGetSourceName(ref name) == ERROR_SUCCESS
            ? (name.viewGdiDeviceName ?? "").Trim() : "";
    }

    static void TargetDeviceName(PATH_INFO path, out string friendlyName, out string devicePath)
    {
        TARGET_DEVICE_NAME name = new TARGET_DEVICE_NAME();
        name.header.type = DEVICE_INFO_GET_TARGET_NAME;
        name.header.size = (uint)Marshal.SizeOf(typeof(TARGET_DEVICE_NAME));
        name.header.adapterId = path.targetInfo.adapterId;
        name.header.id = path.targetInfo.id;

        if (DisplayConfigGetTargetName(ref name) == ERROR_SUCCESS)
        {
            friendlyName = (name.monitorFriendlyDeviceName ?? "").Trim();
            devicePath = (name.monitorDevicePath ?? "").Trim();
        }
        else
        {
            friendlyName = "";
            devicePath = "";
        }
    }

    static string OutputTechnologyLabel(int value)
    {
        switch (value)
        {
            case 0: return "VGA";
            case 4: return "DVI";
            case 5: return "HDMI";
            case 6: return "Interno";
            case 10: return "DisplayPort";
            case 11: return "DisplayPort interno";
            case 12: return "UDI";
            case 13: return "UDI interno";
            case 14: return "Dongle SDTV";
            case 15: return "Miracast";
            case 16: return "Indireto";
            case 17: return "Virtual";
            case 18: return "DisplayPort USB";
            case -1: return "Outro";
            case -2147483648: return "Interno";
            default: return "Conexão " + value;
        }
    }

    static string FormatError(string action, int code)
    {
        switch (code)
        {
            case ERROR_ACCESS_DENIED: return "Sem acesso à sessão de console para alterar monitores.";
            case ERROR_GEN_FAILURE: return "O Windows não conseguiu aplicar a configuração de monitores.";
            case ERROR_NOT_SUPPORTED: return "Configuração de monitores não suportada neste ambiente.";
            case ERROR_INVALID_PARAMETER: return "Parâmetro inválido ao configurar monitores.";
            case ERROR_INSUFFICIENT_BUFFER: return "A configuração de monitores mudou durante a operação.";
            case ERROR_BAD_CONFIGURATION: return "O Windows não encontrou uma configuração válida para esses monitores.";
            default: return action + " falhou com código " + code + ".";
        }
    }
}
'@

try {
  Add-Type -TypeDefinition $source -Language CSharp

  switch ($Action) {
    'list' {
      $payload = [Monitors]::List()
      # InputObject evita que o pipeline "desembrulhe" arrays de 0 ou 1 item.
      $json = ConvertTo-Json -InputObject @($payload) -Depth 4 -Compress
    }
    'enable' { $json = ConvertTo-Json -InputObject ([Monitors]::SetEnabled($Id, $true)) -Depth 5 -Compress }
    'disable' { $json = ConvertTo-Json -InputObject ([Monitors]::SetEnabled($Id, $false)) -Depth 5 -Compress }
    'primary' { $json = ConvertTo-Json -InputObject ([Monitors]::SetPrimary($Id)) -Depth 5 -Compress }
  }

  [Console]::Out.Write($json)
}
catch {
  $message = $_.Exception.Message
  if ($_.Exception.InnerException) { $message = $_.Exception.InnerException.Message }
  [Console]::Out.Write((ConvertTo-Json -InputObject @{ error = $message } -Compress))
  exit 1
}
