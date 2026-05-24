import { CategoryItem, NavItem, Program } from '../models/program.model';
import { NINITE_APPS } from './ninite-apps.data';
import { WINGET_MAP } from './winget-map.data';

export const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Início', icon: 'home', route: '/inicio' },
  { id: 'network', label: 'Rede', icon: 'network', route: '/rede' },
  { id: 'library', label: 'Biblioteca', icon: 'library', route: '/biblioteca' },
  { id: 'store', label: 'Loja', icon: 'store', route: '/loja' },
  { id: 'stats', label: 'Estatísticas', icon: 'stats', route: '/estatisticas' },
  { id: 'tools', label: 'Ferramentas', icon: 'tools', route: '/ferramentas' },
];

export const CATEGORIES: CategoryItem[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'navegadores', label: 'Navegadores' },
  { id: 'mensagens', label: 'Mensagens' },
  { id: 'midia', label: 'Mídia' },
  { id: 'dotnet', label: '.NET' },
  { id: 'java', label: 'Java' },
  { id: 'imagem', label: 'Imagem' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'seguranca', label: 'Segurança' },
  { id: 'compartilhamento', label: 'Compartilhamento' },
  { id: 'armazenamento', label: 'Armazenamento' },
  { id: 'outros', label: 'Outros' },
  { id: 'utilitarios', label: 'Utilitários' },
  { id: 'compressao', label: 'Compressão' },
  { id: 'vcredist', label: 'VC++ Redist' },
  { id: 'desenvolvimento', label: 'Desenvolvimento' },
];

export const PROGRAMS: Program[] = NINITE_APPS.map((program) => ({
  ...program,
  wingetId: WINGET_MAP[program.niniteSlug],
}));

export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
