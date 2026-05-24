/** Mapeamento slug Ninite → ID winget (Windows Package Manager) */
export const WINGET_MAP: Record<string, string> = {
  // Navegadores
  chrome: 'Google.Chrome',
  opera: 'Opera.Opera',
  firefox: 'Mozilla.Firefox',
  edge: 'Microsoft.Edge',
  brave: 'Brave.Brave',
  vivaldi: 'Vivaldi.Vivaldi',

  // Mensagens
  zoom: 'Zoom.Zoom',
  discord: 'Discord.Discord',
  teams: 'Microsoft.Teams',
  pidgin: 'Pidgin.Pidgin',
  thunderbird: 'Mozilla.Thunderbird',

  // Mídia
  vlc: 'VideoLAN.VLC',
  spotify: 'Spotify.Spotify',
  audacity: 'Audacity.Audacity',
  handbrake: 'HandBrake.HandBrake',
  foobar2000: 'PeterPawlowski.foobar2000',
  winamp: 'Winamp.Winamp',
  musicbee: 'MusicBee.MusicBee',
  mediamonkey: 'VentisMedia.MediaMonkey.5',
  aimp: 'AIMP.AIMP',

  // .NET
  dotnet481: 'Microsoft.DotNet.Framework.DeveloperPack.4.8.1',
  dotnetdesktop8x64: 'Microsoft.DotNet.DesktopRuntime.8',
  dotnetdesktop8: 'Microsoft.DotNet.DesktopRuntime.8',
  dotnetdesktop9x64: 'Microsoft.DotNet.DesktopRuntime.9',
  dotnetdesktop9: 'Microsoft.DotNet.DesktopRuntime.9',
  dotnetdesktop10x64: 'Microsoft.DotNet.DesktopRuntime.Preview',
  dotnetdesktop10: 'Microsoft.DotNet.DesktopRuntime.Preview',
  aspnetcore8x64: 'Microsoft.DotNet.AspNetCore.8',
  aspnetcore8: 'Microsoft.DotNet.AspNetCore.8',
  aspnetcore9x64: 'Microsoft.DotNet.AspNetCore.9',
  aspnetcore9: 'Microsoft.DotNet.AspNetCore.9',

  // Java
  adoptjdk8x64: 'EclipseAdoptium.Temurin.8.JDK',
  adoptjdk11x64: 'EclipseAdoptium.Temurin.11.JDK',
  adoptjdk17x64: 'EclipseAdoptium.Temurin.17.JDK',
  adoptjdk21x64: 'EclipseAdoptium.Temurin.21.JDK',
  adoptjdk25x64: 'EclipseAdoptium.Temurin.25.JDK',
  adoptjdk8x64dev: 'EclipseAdoptium.Temurin.8.JDK',
  adoptjdk11x64dev: 'EclipseAdoptium.Temurin.11.JDK',
  adoptjdk17x64dev: 'EclipseAdoptium.Temurin.17.JDK',
  adoptjdk21x64dev: 'EclipseAdoptium.Temurin.21.JDK',
  adoptjdk25x64dev: 'EclipseAdoptium.Temurin.25.JDK',
  correttojdk8x64: 'Amazon.Corretto.8.JDK',
  correttojdk11x64: 'Amazon.Corretto.11.JDK',
  correttojdk17x64: 'Amazon.Corretto.17.JDK',
  correttojdk21x64: 'Amazon.Corretto.21.JDK',
  correttojdk25x64: 'Amazon.Corretto.25.JDK',

  // Imagem
  krita: 'KDE.Krita',
  blender: 'BlenderFoundation.Blender',
  'paint.net': 'dotPDNLLC.paintdotnet',
  gimp: 'GIMP.GIMP.3',
  irfanview: 'IrfanSkiljan.IrfanView',
  inkscape: 'Inkscape.Inkscape',
  greenshot: 'Greenshot.Greenshot',
  sharex: 'ShareX.ShareX',

  // Documentos
  foxitreader: 'Foxit.FoxitReader',
  libreoffice: 'TheDocumentFoundation.LibreOffice',
  sumatrapdf: 'SumatraPDF.SumatraPDF',
  openoffice: 'Apache.OpenOffice',

  // Segurança
  malwarebytes: 'Malwarebytes.Malwarebytes',
  avast: 'Avast.AvastFreeAntivirus',
  avg: 'AVG.AntiVirus.Free',
  avira: 'Avira.AviraSecurity',

  // Compartilhamento
  qbittorrent: 'qBittorrent.qBittorrent',

  // Armazenamento
  dropbox: 'Dropbox.Dropbox',
  googledrive: 'Google.GoogleDrive',
  onedrive: 'Microsoft.OneDrive',

  // Outros
  evernote: 'Evernote.Evernote',
  googleearth: 'Google.EarthPro',
  steam: 'Valve.Steam',
  epicgames: 'EpicGames.EpicGamesLauncher',
  keepass2: 'DominikReichl.KeePass',
  everything: 'voidtools.Everything',

  // Utilitários
  anydesk: 'AnyDesk.AnyDesk',
  teamviewer15: 'TeamViewer.TeamViewer',
  teracopy: 'CodeSector.TeraCopy',
  revo: 'RevoUninstaller.RevoUninstaller',
  windirstat: 'WinDirStat.WinDirStat',
  wiztree: 'AntibodySoftware.WizTree',
  ccleaner: 'Piriform.CCleaner',
  openshell: 'OpenShellMenu.OpenShell',
  putty: 'PuTTY.PuTTY',

  // Compressão
  '7zip': '7zip.7zip',
  peazip: 'PeaZip.PeaZip',
  winrar: 'RARLab.WinRAR',

  // VC++ Redist
  vcredist2015x64: 'Microsoft.VCRedist.2015+.x64',
  vcredist2015x86: 'Microsoft.VCRedist.2015+.x86',
  vcredist2013x64: 'Microsoft.VCRedist.2013.x64',
  vcredist2013x86: 'Microsoft.VCRedist.2013.x86',
  vcredist2012x64: 'Microsoft.VCRedist.2012.x64',
  vcredist2012x86: 'Microsoft.VCRedist.2012.x86',

  // Desenvolvimento
  python3x64: 'Python.Python.3.13',
  python3: 'Python.Python.3.13',
  python: 'Python.Launcher',
  git: 'Git.Git',
  filezilla: 'TimKosse.FileZilla.Client',
  notepadplusplus: 'Notepad++.Notepad++',
  winscp: 'WinSCP.WinSCP',
  winmerge: 'WinMerge.WinMerge',
  vscode: 'Microsoft.VisualStudioCode',
  cursor: 'Anysphere.Cursor',
};

export function getWingetId(slug: string): string | undefined {
  return WINGET_MAP[slug];
}
