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
    path: 'queens',
    loadComponent: () =>
      import('./games/queens/queens').then((m) => m.Queens),
  },
  {
    path: 'zip',
    loadComponent: () =>
      import('./games/zip/zip').then((m) => m.Zip),
  },
  {
    path: 'thread',
    loadComponent: () =>
      import('./games/thread/thread').then((m) => m.Thread),
  },
  { path: '**', redirectTo: '' },
];
