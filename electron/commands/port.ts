import { combine, requireWindows, run } from '../exec';
import { registerAll } from '../registry';

function assertPort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Informe uma porta entre 1 e 65535.');
  }
}

function localAddrUsesPort(local: string, port: number): boolean {
  return local.endsWith(`:${port}`) || local.includes(`]:${port}`);
}

async function findPidsOnPort(port: number): Promise<number[]> {
  const result = await run('netstat', ['-ano']);
  if (result.spawnError) {
    throw new Error(`Falha ao executar netstat: ${result.spawnError}`);
  }
  if (result.code !== 0) {
    throw new Error('netstat retornou erro');
  }

  const pids = new Set<number>();

  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('TCP') && !trimmed.startsWith('UDP')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length < 4) continue;
    if (!localAddrUsesPort(parts[1], port)) continue;

    const pid = Number(parts[parts.length - 1]);
    if (Number.isInteger(pid) && pid > 4) {
      pids.add(pid);
    }
  }

  return [...pids];
}

async function killPid(pid: number): Promise<string | null> {
  const result = await run('taskkill', ['/PID', String(pid), '/F']);
  if (result.spawnError) return `Falha ao executar taskkill: ${result.spawnError}`;
  if (result.code === 0) return null;
  return combine(result) || `taskkill falhou para PID ${pid}`;
}

async function processNameForPid(pid: number): Promise<string> {
  const fallback = `PID ${pid}`;
  const result = await run('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
  const line = result.stdout.trim();
  if (!line || line.startsWith('INFO:')) return fallback;

  const name = line.split(',')[0]?.replace(/^"|"$/g, '').trim();
  return name || fallback;
}

registerAll({
  async inspect_port({ port }: { port: number }) {
    assertPort(port);
    requireWindows();

    const pids = await findPidsOnPort(port);
    const processes = await Promise.all(
      pids.map(async (pid) => ({ pid, name: await processNameForPid(pid) })),
    );

    const message = processes.length
      ? `Porta ${port}: ${processes.map((p) => `${p.name} (${p.pid})`).join(', ')}`
      : `Nenhum processo na porta ${port}.`;

    return { port, processes, message };
  },

  async kill_port({ port }: { port: number }) {
    assertPort(port);
    requireWindows();

    const pids = await findPidsOnPort(port);
    if (pids.length === 0) {
      return { port, pids: [], killed: [], message: `Nenhum processo usando a porta ${port}.` };
    }

    const killed: number[] = [];
    const errors: string[] = [];

    for (const pid of pids) {
      const error = await killPid(pid);
      if (error === null) killed.push(pid);
      else errors.push(`PID ${pid}: ${error}`);
    }

    let message: string;
    if (killed.length === 0) {
      message = `Não foi possível encerrar os processos na porta ${port}. ${errors.join(' ')}`;
    } else if (errors.length === 0) {
      message = `Porta ${port} liberada. Processo(s) encerrado(s): ${killed.join(', ')}.`;
    } else {
      message = `Porta ${port}: encerrado(s) ${killed.join(', ')}. Falha em: ${errors.join(' ')}`;
    }

    return { port, pids, killed, message };
  },
});
