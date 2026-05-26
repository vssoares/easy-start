import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { LibraryComponent } from './pages/library/library.component';
import { NodePageComponent } from './pages/node/node-page.component';
import { PlaceholderPageComponent } from './pages/placeholder/placeholder-page.component';
import { QuickAccessPageComponent } from './pages/quick-access/quick-access-page.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'biblioteca', pathMatch: 'full' },
      { path: 'inicio', component: PlaceholderPageComponent, data: { title: 'Início' } },
      { path: 'rede', component: PlaceholderPageComponent, data: { title: 'Rede' } },
      { path: 'biblioteca', component: LibraryComponent },
      { path: 'node', component: NodePageComponent },
      { path: 'acesso-rapido', component: QuickAccessPageComponent },
      { path: 'loja', component: PlaceholderPageComponent, data: { title: 'Loja' } },
      {
        path: 'estatisticas',
        component: PlaceholderPageComponent,
        data: { title: 'Estatísticas' },
      },
      {
        path: 'ferramentas',
        component: PlaceholderPageComponent,
        data: { title: 'Ferramentas' },
      },
    ],
  },
];
