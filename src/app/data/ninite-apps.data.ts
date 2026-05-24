import { Program } from '../models/program.model';

type AppCategory = Program['category'];

function app(
  slug: string,
  name: string,
  category: AppCategory,
  color: string,
  initial?: string,
): Program {
  return {
    id: slug,
    name,
    category,
    color,
    initial: initial ?? name.slice(0, 2).toUpperCase(),
    niniteSlug: slug,
  };
}

/** Catálogo oficial do Ninite — https://ninite.com/ */
export const NINITE_APPS: Program[] = [
  // Navegadores
  app('chrome', 'Chrome', 'navegadores', '#4285f4', 'Ch'),
  app('opera', 'Opera', 'navegadores', '#ff1b2d', 'Op'),
  app('firefox', 'Firefox', 'navegadores', '#ff7139', 'Fx'),
  app('edge', 'Edge', 'navegadores', '#0078d4', 'Ed'),
  app('brave', 'Brave', 'navegadores', '#fb542b', 'Br'),
  app('vivaldi', 'Vivaldi', 'navegadores', '#ef3939', 'Vi'),

  // Mensagens
  app('zoom', 'Zoom', 'mensagens', '#2d8cff', 'Zm'),
  app('discord', 'Discord', 'mensagens', '#5865f2', 'Dc'),
  app('teams', 'Teams', 'mensagens', '#6264a7', 'Tm'),
  app('pidgin', 'Pidgin', 'mensagens', '#7b4397', 'Pg'),
  app('thunderbird', 'Thunderbird', 'mensagens', '#0a84ff', 'Tb'),
  app('trillian', 'Trillian', 'mensagens', '#3b5998', 'Tr'),

  // Mídia
  app('itunes', 'iTunes', 'midia', '#fa233b', 'iT'),
  app('vlc', 'VLC', 'midia', '#ff8800', 'VL'),
  app('aimp', 'AIMP', 'midia', '#ffc107', 'AI'),
  app('foobar2000', 'foobar2000', 'midia', '#c0c0c0', 'fb'),
  app('winamp', 'Winamp', 'midia', '#f93822', 'WA'),
  app('musicbee', 'MusicBee', 'midia', '#ffc830', 'MB'),
  app('audacity', 'Audacity', 'midia', '#0000cc', 'Au'),
  app('klitecodecs', 'K-Lite Codecs', 'midia', '#0066cc', 'KL'),
  app('gom', 'GOM', 'midia', '#ff6600', 'GM'),
  app('spotify', 'Spotify', 'midia', '#1db954', 'Sp'),
  app('cccp', 'CCCP', 'midia', '#336699', 'CC'),
  app('mediamonkey', 'MediaMonkey', 'midia', '#e91e63', 'MM'),
  app('handbrake', 'HandBrake', 'midia', '#439cb8', 'HB'),

  // .NET
  app('dotnet481', '.NET 4.8.1', 'dotnet', '#512bd4', '48'),
  app('dotnetdesktop8x64', '.NET Desktop Runtime x64 8', 'dotnet', '#512bd4', 'D8'),
  app('dotnetdesktop8arm64', '.NET Desktop Runtime arm64 8', 'dotnet', '#512bd4', 'A8'),
  app('dotnetdesktop8', '.NET Desktop Runtime 8', 'dotnet', '#512bd4', 'N8'),
  app('dotnetdesktop9x64', '.NET Desktop Runtime x64 9', 'dotnet', '#512bd4', 'D9'),
  app('dotnetdesktop9arm64', '.NET Desktop Runtime arm64 9', 'dotnet', '#512bd4', 'A9'),
  app('dotnetdesktop9', '.NET Desktop Runtime 9', 'dotnet', '#512bd4', 'N9'),
  app('dotnetdesktop10x64', '.NET Desktop Runtime x64 10', 'dotnet', '#512bd4', 'X10'),
  app('dotnetdesktop10arm64', '.NET Desktop Runtime arm64 10', 'dotnet', '#512bd4', 'R10'),
  app('dotnetdesktop10', '.NET Desktop Runtime 10', 'dotnet', '#512bd4', 'N10'),
  app('aspnetcore8x64', 'ASP.NET Core Runtime x64 8', 'dotnet', '#512bd4', 'AS8'),
  app('aspnetcore8arm64', 'ASP.NET Core Runtime arm64 8', 'dotnet', '#512bd4', 'AA8'),
  app('aspnetcore8', 'ASP.NET Core Runtime 8', 'dotnet', '#512bd4', 'AP8'),
  app('aspnetcore9x64', 'ASP.NET Core Runtime x64 9', 'dotnet', '#512bd4', 'AS9'),
  app('aspnetcore9arm64', 'ASP.NET Core Runtime arm64 9', 'dotnet', '#512bd4', 'AA9'),
  app('aspnetcore9', 'ASP.NET Core Runtime 9', 'dotnet', '#512bd4', 'AP9'),
  app('aspnetcore10x64', 'ASP.NET Core Runtime x64 10', 'dotnet', '#512bd4', 'X10'),
  app('aspnetcore10arm64', 'ASP.NET Core Runtime arm64 10', 'dotnet', '#512bd4', 'R10'),
  app('aspnetcore10', 'ASP.NET Core Runtime 10', 'dotnet', '#512bd4', 'P10'),

  // Java
  app('adoptjdk8x64', 'Java (AdoptOpenJDK) x64 8', 'java', '#5382a1', 'J8'),
  app('adoptjdk8', 'Java (AdoptOpenJDK) 8', 'java', '#5382a1', 'J8'),
  app('adoptjdk11x64', 'Java (AdoptOpenJDK) x64 11', 'java', '#5382a1', 'J11'),
  app('adoptjdk17x64', 'Java (AdoptOpenJDK) x64 17', 'java', '#5382a1', 'J17'),
  app('adoptjdk21x64', 'Java (AdoptOpenJDK) x64 21', 'java', '#5382a1', 'J21'),
  app('adoptjdk25x64', 'Java (AdoptOpenJDK) x64 25', 'java', '#5382a1', 'J25'),
  app('adoptjdk8x64dev', 'JDK (AdoptOpenJDK) x64 8', 'java', '#5382a1', 'K8'),
  app('adoptjdk8dev', 'JDK (AdoptOpenJDK) 8', 'java', '#5382a1', 'K8'),
  app('adoptjdk11x64dev', 'JDK (AdoptOpenJDK) x64 11', 'java', '#5382a1', 'K11'),
  app('adoptjdk17x64dev', 'JDK (AdoptOpenJDK) x64 17', 'java', '#5382a1', 'K17'),
  app('adoptjdk21x64dev', 'JDK (AdoptOpenJDK) x64 21', 'java', '#5382a1', 'K21'),
  app('adoptjdk25x64dev', 'JDK (AdoptOpenJDK) x64 25', 'java', '#5382a1', 'K25'),
  app('correttojdk8x64', 'JDK (Amazon Corretto) x64 8', 'java', '#ff9900', 'C8'),
  app('correttojdk8', 'JDK (Amazon Corretto) 8', 'java', '#ff9900', 'C8'),
  app('correttojdk11x64', 'JDK (Amazon Corretto) x64 11', 'java', '#ff9900', 'C11'),
  app('correttojdk17x64', 'JDK (Amazon Corretto) x64 17', 'java', '#ff9900', 'C17'),
  app('correttojdk21x64', 'JDK (Amazon Corretto) x64 21', 'java', '#ff9900', 'C21'),
  app('correttojdk25x64', 'JDK (Amazon Corretto) x64 25', 'java', '#ff9900', 'C25'),
  app('correttojre8x64', 'JRE (Amazon Corretto) x64 8', 'java', '#ff9900', 'R8'),
  app('correttojre8', 'JRE (Amazon Corretto) 8', 'java', '#ff9900', 'R8'),

  // Imagem
  app('krita', 'Krita', 'imagem', '#3babff', 'Kr'),
  app('blender', 'Blender', 'imagem', '#265787', 'Bl'),
  app('paint.net', 'Paint.NET', 'imagem', '#0066cc', 'PN'),
  app('gimp', 'GIMP', 'imagem', '#5c5543', 'Gi'),
  app('irfanview', 'IrfanView', 'imagem', '#006699', 'IV'),
  app('xnview', 'XnView', 'imagem', '#0099cc', 'Xn'),
  app('inkscape', 'Inkscape', 'imagem', '#ffffff', 'In'),
  app('faststone', 'FastStone', 'imagem', '#336699', 'FS'),
  app('greenshot', 'Greenshot', 'imagem', '#55a630', 'Gr'),
  app('sharex', 'ShareX', 'imagem', '#0066cc', 'Sh'),

  // Documentos
  app('foxitreader', 'Foxit Reader', 'documentos', '#e31837', 'Fx'),
  app('libreoffice', 'LibreOffice', 'documentos', '#18a303', 'LO'),
  app('sumatrapdf', 'SumatraPDF', 'documentos', '#cc0000', 'SP'),
  app('cutepdf', 'CutePDF', 'documentos', '#0066cc', 'CP'),
  app('openoffice', 'OpenOffice', 'documentos', '#0e85cd', 'OO'),

  // Segurança
  app('malwarebytes', 'Malwarebytes', 'seguranca', '#0066cc', 'MB'),
  app('avast', 'Avast', 'seguranca', '#ff7800', 'Av'),
  app('avg', 'AVG', 'seguranca', '#008000', 'AV'),
  app('spybot2', 'Spybot 2', 'seguranca', '#cc0000', 'Sb'),
  app('avira', 'Avira', 'seguranca', '#d40000', 'Ar'),
  app('superantispyware', 'SUPERAntiSpyware', 'seguranca', '#006699', 'SA'),

  // Compartilhamento
  app('qbittorrent', 'qBittorrent', 'compartilhamento', '#2f67ba', 'qB'),

  // Armazenamento
  app('dropbox', 'Dropbox', 'armazenamento', '#0061ff', 'Db'),
  app('googledrive', 'Google Drive for Desktop', 'armazenamento', '#4285f4', 'GD'),
  app('onedrive', 'OneDrive', 'armazenamento', '#0078d4', 'OD'),
  app('sugarsync', 'SugarSync', 'armazenamento', '#0099cc', 'SS'),

  // Outros
  app('evernote', 'Evernote', 'outros', '#00a82d', 'En'),
  app('googleearth', 'Google Earth', 'outros', '#4285f4', 'GE'),
  app('steam', 'Steam', 'outros', '#1b2838', 'St'),
  app('epicgames', 'Epic Games Launcher', 'outros', '#2f2f2f', 'Ep'),
  app('keepass2', 'KeePass 2', 'outros', '#6caf00', 'KP'),
  app('everything', 'Everything', 'outros', '#ffd700', 'Ev'),
  app('nvaccess', 'NV Access', 'outros', '#0066cc', 'NV'),

  // Utilitários
  app('anydesk', 'AnyDesk', 'utilitarios', '#ef443b', 'AD'),
  app('teamviewer15', 'TeamViewer 15', 'utilitarios', '#0e8ee9', 'TV'),
  app('imgburn', 'ImgBurn', 'utilitarios', '#cc6600', 'IB'),
  app('realvncserver', 'RealVNC Server', 'utilitarios', '#cc0000', 'VS'),
  app('realvncviewer', 'RealVNC Viewer', 'utilitarios', '#cc0000', 'VV'),
  app('tightvnc', 'TightVNC', 'utilitarios', '#006699', 'TV'),
  app('teracopy', 'TeraCopy', 'utilitarios', '#0066cc', 'TC'),
  app('cdburnerxp', 'CDBurnerXP', 'utilitarios', '#ff6600', 'CD'),
  app('revo', 'Revo', 'utilitarios', '#0066cc', 'Rv'),
  app('launchy', 'Launchy', 'utilitarios', '#333333', 'La'),
  app('windirstat', 'WinDirStat', 'utilitarios', '#006699', 'WD'),
  app('wiztree', 'WizTree', 'utilitarios', '#ffd700', 'WZ'),
  app('glary', 'Glary', 'utilitarios', '#0066cc', 'Gl'),
  app('infrarecorder', 'InfraRecorder', 'utilitarios', '#cc6600', 'IR'),
  app('openshell', 'Open-Shell', 'utilitarios', '#0078d4', 'OS'),
  app('ccleaner', 'CCleaner', 'utilitarios', '#0066cc', 'CC'),

  // Compressão
  app('7zip', '7-Zip', 'compressao', '#0066cc', '7z'),
  app('peazip', 'PeaZip', 'compressao', '#006699', 'Pz'),
  app('winrar', 'WinRAR', 'compressao', '#0066cc', 'WR'),

  // VC++ Redistributables
  app('vcredist2015x64', 'VC Redist x64 2015+', 'vcredist', '#68217a', 'V15'),
  app('vcredist2015x86', 'VC Redist x86 2015+', 'vcredist', '#68217a', 'V15'),
  app('vcredist2015arm64', 'VC Redist arm64 2015+', 'vcredist', '#68217a', 'VA'),
  app('vcredist2013x64', 'VC Redist x64 2013', 'vcredist', '#68217a', 'V13'),
  app('vcredist2013x86', 'VC Redist x86 2013', 'vcredist', '#68217a', 'V13'),
  app('vcredist2012x64', 'VC Redist x64 2012', 'vcredist', '#68217a', 'V12'),
  app('vcredist2012x86', 'VC Redist x86 2012', 'vcredist', '#68217a', 'V12'),
  app('vcredist2010x64', 'VC Redist x64 2010', 'vcredist', '#68217a', 'V10'),
  app('vcredist2010x86', 'VC Redist x86 2010', 'vcredist', '#68217a', 'V10'),
  app('vcredist2008x64', 'VC Redist x64 2008', 'vcredist', '#68217a', 'V08'),
  app('vcredist2008x86', 'VC Redist x86 2008', 'vcredist', '#68217a', 'V08'),
  app('vcredist2005x64', 'VC Redist x64 2005', 'vcredist', '#68217a', 'V05'),
  app('vcredist2005x86', 'VC Redist x86 2005', 'vcredist', '#68217a', 'V05'),

  // Desenvolvimento
  app('python3x64', 'Python x64 3', 'desenvolvimento', '#3776ab', 'Py'),
  app('python3arm64', 'Python arm64 3', 'desenvolvimento', '#3776ab', 'Py'),
  app('python3', 'Python 3', 'desenvolvimento', '#3776ab', 'Py'),
  app('python', 'Python', 'desenvolvimento', '#3776ab', 'Py'),
  app('git', 'Git', 'desenvolvimento', '#f05032', 'Gi'),
  app('filezilla', 'FileZilla', 'desenvolvimento', '#bf0000', 'FZ'),
  app('notepadplusplus', 'Notepad++', 'desenvolvimento', '#8bc34a', 'N++'),
  app('winscp', 'WinSCP', 'desenvolvimento', '#0066cc', 'WS'),
  app('putty', 'PuTTY', 'desenvolvimento', '#0066cc', 'Pu'),
  app('winmerge', 'WinMerge', 'desenvolvimento', '#006699', 'WM'),
  app('eclipse', 'Eclipse', 'desenvolvimento', '#2c2255', 'Ec'),
  app('vscode', 'Visual Studio Code', 'desenvolvimento', '#007acc', 'VS'),
  app('cursor', 'Cursor', 'desenvolvimento', '#000000', 'Cu'),
];
