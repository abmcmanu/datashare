import { Routes } from '@angular/router';

import { HomeComponent } from './features/home/home.component';

/**
 * Routage de l'application.
 * Les routes seront enrichies dans les étapes suivantes
 * (login, signup, mes-fichiers, /d/:token).
 */
export const APP_ROUTES: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: '**', redirectTo: '' }
];
