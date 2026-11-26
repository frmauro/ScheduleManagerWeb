import type { Route } from '@angular/router';

/**
 * Última rota de cada área: caminho desconhecido dentro de `/cliente`, `/prestador` ou `/admin`
 * mostra "não encontrado" **depois** dos guards da área (sessão e perfil).
 */
export const AREA_NOT_FOUND_ROUTE: Route = {
  path: '**',
  title: 'Página não encontrada · ScheduleManager',
  loadComponent: () => import('./not-found.page').then((m) => m.NotFoundPageComponent),
};
