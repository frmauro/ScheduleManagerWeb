import type { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { guestGuard } from './core/auth/guest.guard';
import { AUTH_MESSAGES } from './core/i18n/auth.messages';
import { CATALOG_MESSAGES } from './core/i18n/catalog.messages';

/**
 * Rotas da aplicação (contracts/routes.md). Cada área é carregada sob demanda e protegida por
 * sessão + perfil. As telas de cada história entram nos arquivos de rotas das áreas.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: CATALOG_MESSAGES.search.pageTitle,
    loadComponent: () =>
      import('./features/catalog/provider-search.page').then((m) => m.ProviderSearchPageComponent),
  },
  {
    path: 'prestadores/:providerId',
    title: CATALOG_MESSAGES.profile.pageTitle,
    loadComponent: () =>
      import('./features/catalog/provider-profile.page').then(
        (m) => m.ProviderProfilePageComponent,
      ),
  },
  {
    path: 'entrar',
    title: AUTH_MESSAGES.login.pageTitle,
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPageComponent),
  },
  {
    path: 'cadastro',
    pathMatch: 'full',
    title: AUTH_MESSAGES.registerCustomer.pageTitle,
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register-customer.page').then((m) => m.RegisterCustomerPageComponent),
  },
  {
    path: 'cadastro/prestador',
    title: AUTH_MESSAGES.registerProvider.pageTitle,
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/register-provider.page').then((m) => m.RegisterProviderPageComponent),
  },
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
