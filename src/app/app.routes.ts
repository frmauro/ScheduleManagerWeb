import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

/**
 * Rotas da aplicação (contracts/routes.md). Cada área é carregada sob demanda e protegida por
 * sessão + perfil. As telas de cada história entram nos arquivos de rotas das áreas.
 */
export const routes: Routes = [
  {
    path: 'cliente',
    canActivate: [authGuard, roleGuard('Customer')],
    loadChildren: () =>
      import('./features/customer/customer.routes').then((m) => m.CUSTOMER_ROUTES),
  },
  {
    path: 'prestador',
    canActivate: [authGuard, roleGuard('Provider')],
    loadChildren: () =>
      import('./features/provider/provider.routes').then((m) => m.PROVIDER_ROUTES),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('Admin')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'sem-permissao',
    title: 'Sem permissão · ScheduleManager',
    loadComponent: () =>
      import('./features/errors/forbidden.page').then((m) => m.ForbiddenPageComponent),
  },
  {
    path: 'erro',
    title: 'Erro inesperado · ScheduleManager',
    loadComponent: () =>
      import('./features/errors/unexpected-error.page').then((m) => m.UnexpectedErrorPageComponent),
  },
  {
    path: '**',
    title: 'Página não encontrada · ScheduleManager',
    loadComponent: () =>
      import('./features/errors/not-found.page').then((m) => m.NotFoundPageComponent),
  },
];
