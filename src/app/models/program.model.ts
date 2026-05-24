export type ProgramCategory =
  | 'todos'
  | 'navegadores'
  | 'mensagens'
  | 'midia'
  | 'dotnet'
  | 'java'
  | 'imagem'
  | 'documentos'
  | 'seguranca'
  | 'compartilhamento'
  | 'armazenamento'
  | 'outros'
  | 'utilitarios'
  | 'compressao'
  | 'vcredist'
  | 'desenvolvimento';

export interface Program {
  id: string;
  name: string;
  category: Exclude<ProgramCategory, 'todos'>;
  color: string;
  initial: string;
  niniteSlug: string;
  wingetId?: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
}

export interface CategoryItem {
  id: ProgramCategory;
  label: string;
}
