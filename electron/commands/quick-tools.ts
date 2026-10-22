import { clipboard, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { combine, launch, requireWindows, run } from '../exec';
import { registerAll } from '../registry';

const result = (message: string) => ({ message });

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente não encontrada: ${name}.`);
  }
  return value;
}

function knownFolderPath(folder: string): string {
  const home = () => env('USERPROFILE');

  const resolvers: Record<string, () => string> = {
    desktop: () => path.join(home(), 'Desktop'),
    downloads: () => path.join(home(), 'Downloads'),
    documents: () => path.join(home(), 'Documents'),
    pictures: () => path.join(home(), 'Pictures'),
    appdata: () => env('APPDATA'),
    localappdata: () => env('LOCALAPPDATA'),
    temp: () => env('TEMP'),
    home,
  };

  const resolve = resolvers[folder];
  if (!resolve) {
    throw new Error(`Pasta desconhecida: ${folder}`);
  }

  const target = resolve();
  if (!fs.existsSync(target)) {
    throw new Error(`Pasta não existe: ${target}`);
  }
  return target;
}

/** Extrai os endereços IPv4 do `ipconfig`, independente do idioma do Windows. */
function parseIpconfig(text: string): { name: string; address: string }[] {
  const adapters: { name: string; address: string }[] = [];
  let currentName = 'Adaptador';

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;

    // Cabeçalho de adaptador: sem indentação e terminado em ":".
    if (!/^\s/.test(line) && line.trimEnd().endsWith(':')) {
      currentName = line.trim().slice(0, -1);
      continue;
    }

    if (/ipv4/i.test(line)) {
      const address = line.match(/:\s*(\d{1,3}(?:\.\d{1,3}){3})/)?.[1];
      if (address && address !== '0.0.0.0') {
        adapters.push({ name: currentName, address });
      }
    }
  }

  return adapters;
}

async function openTool(file: string, args: string[], failure: string, success: string) {
  try {
    await launch(file, args);
  } catch (error) {
    throw new Error(`${failure}: ${(error as Error).message}`);
  }
  return result(success);
}

registerAll({
  async open_special_folder({ folder }: { folder: string }) {
    requireWindows();

    const target = knownFolderPath(String(folder).trim());
    const error = await shell.openPath(target);
    if (error) {
      throw new Error(`Falha ao abrir pasta: ${error}`);
    }
    return result(`Abrindo ${target}`);
  },

  async flush_dns() {
    requireWindows();

    const output = await run('ipconfig', ['/flushdns']);
    if (output.spawnError) {
      throw new Error(`Falha ao executar: ${output.spawnError}`);
    }
    const message = combine(output);
    if (output.code !== 0) {
      throw new Error(message || 'Comando falhou.');
    }
    return result(message || 'Concluído.');
  },

  async restart_explorer() {
    requireWindows();

    await run('taskkill', ['/IM', 'explorer.exe', '/F']);
    try {
      await launch('explorer.exe');
    } catch (error) {
      throw new Error(`Falha ao reiniciar Explorer: ${(error as Error).message}`);
    }
    return result('Explorer reiniciado.');
  },

  async list_local_ips() {
    requireWindows();

    const output = await run('ipconfig');
    if (output.spawnError) {
      throw new Error(`Falha ao executar ipconfig: ${output.spawnError}`);
    }

    const adapters = parseIpconfig(output.stdout);
    if (adapters.length === 0) {
      throw new Error('Nenhum endereço IPv4 encontrado.');
    }
    return adapters;
  },

  copy_to_clipboard({ text }: { text: string }) {
    requireWindows();

    const value = String(text ?? '').trim();
    if (!value) {
      throw new Error('Nada para copiar.');
    }
    clipboard.writeText(value);
    return result('Copiado para a área de transferência.');
  },

  async open_system_tool({ tool }: { tool: string }) {
    requireWindows();

    switch (String(tool).trim().toLowerCase()) {
      case 'taskmgr':
        return openTool(
          'taskmgr',
          [],
          'Falha ao abrir Gerenciador de Tarefas',
          'Gerenciador de Tarefas aberto.',
        );
      case 'hosts': {
        const hosts = path.join(env('SystemRoot'), 'System32', 'drivers', 'etc', 'hosts');
        return openTool(
          'notepad',
          [hosts],
          'Falha ao abrir hosts',
          'Arquivo hosts aberto no Bloco de Notas.',
        );
      }
      case 'env':
        return openTool(
          'rundll32',
          ['sysdm.cpl,EditEnvironmentVariables'],
          'Falha ao abrir variáveis de ambiente',
          'Variáveis de ambiente abertas.',
        );
      case 'services': {
        const error = await shell.openPath('services.msc');
        if (error) {
          throw new Error(`Falha ao abrir Serviços: ${error}`);
        }
        return result('Serviços do Windows abertos.');
      }
      default:
        throw new Error(`Ferramenta desconhecida: ${tool}`);
    }
  },
});
