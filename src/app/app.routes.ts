import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'tango',
    loadComponent: () =>
      import('./games/tango/tango').then((m) => m.Tango),
  },
  {
    path: 'zip',
    loadComponent: () =>
      import('./games/zip/zip').then((m) => m.Zip),
  },
  { path: '**', redirectTo: '' },
];
