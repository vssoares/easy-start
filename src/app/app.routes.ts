import { Routes } from '@angular/router';
import { ShellComponent } from './layout/shell/shell.component';
import { HelpPageComponent } from './pages/help/help-page.component';
import { HomePageComponent } from './pages/home/home-page.component';
import { LibraryComponent } from './pages/library/library.component';
import { MakerPageComponent } from './pages/maker/maker-page.component';
import { MonitorsPageComponent } from './pages/monitors/monitors-page.component';
import { NetworkPageComponent } from './pages/network/network-page.component';
import { NodePageComponent } from './pages/node/node-page.component';
import { OptimizePageComponent } from './pages/optimize/optimize-page.component';
import { PlaceholderPageComponent } from './pages/placeholder/placeholder-page.component';
import { QuickAccessPageComponent } from './pages/quick-access/quick-access-page.component';
import { SensorsPageComponent } from './pages/sensors/sensors-page.component';
import { SettingsPageComponent } from './pages/settings/settings-page.component';
import { StartupPageComponent } from './pages/startup/startup-page.component';
import { SystemInfoPageComponent } from './pages/system-info/system-info-page.component';

export const routes: Routes = [
  {
    path: '',
    component: ShellComponent,
    children: [
      { path: '', redirectTo: 'biblioteca', pathMatch: 'full' },
      { path: 'inicio', component: HomePageComponent },
      { path: 'rede', component: NetworkPageComponent },
      { path: 'configuracoes', component: SettingsPageComponent },
      { path: 'ajuda', component: HelpPageComponent },
      { path: 'biblioteca', component: LibraryComponent },
      { path: 'node', component: NodePageComponent },
      { path: 'acesso-rapido', component: QuickAccessPageComponent },
      { path: 'monitores', component: MonitorsPageComponent },
      { path: 'sistema', component: SystemInfoPageComponent },
      { path: 'loja', component: PlaceholderPageComponent, data: { title: 'Loja' } },
      {
        path: 'estatisticas',
        component: PlaceholderPageComponent,
        data: { title: 'Estatísticas' },
      },
      { path: 'otimizacao', component: OptimizePageComponent },
      { path: 'inicializacao', component: StartupPageComponent },
      { path: 'maker', component: MakerPageComponent },
      { path: 'sensores', component: SensorsPageComponent },
    ],
  },
];
