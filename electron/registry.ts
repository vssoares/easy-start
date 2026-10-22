import type { WebContents } from 'electron';

export type CommandContext = { sender: WebContents };
export type CommandHandler = (args: any, context: CommandContext) => unknown | Promise<unknown>;

const commands = new Map<string, CommandHandler>();

export function register(name: string, handler: CommandHandler): void {
  commands.set(name, handler);
}

export function registerAll(group: Record<string, CommandHandler>): void {
  for (const [name, handler] of Object.entries(group)) {
    register(name, handler);
  }
}

export function getCommand(name: string): CommandHandler | undefined {
  return commands.get(name);
}
