import { app, shell } from 'electron';
import { isAdmin } from '../ps';
import { registerAll } from '../registry';

/** Só estes endereços podem ser abertos a partir da interface. */
const ALLOWED_LINKS = new Set([
  'https://github.com/vssoares/easy-start',
  'https://github.com/vssoares/easy-start/releases/latest',
  'https://github.com/vssoares/easy-start/issues',
]);

registerAll({
  is_admin: () => isAdmin(),

  async open_data_folder() {
    const error = await shell.openPath(app.getPath('userData'));
    if (error) throw new Error(error);
    return { message: 'Pasta de dados aberta.' };
  },

  async open_link({ url }: { url: string }) {
    if (!ALLOWED_LINKS.has(url)) throw new Error('Endereço não permitido.');
    await shell.openExternal(url);
    return { message: 'Aberto no navegador.' };
  },
});
