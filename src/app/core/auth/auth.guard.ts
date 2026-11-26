import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { LOGIN_PATH } from './session-expiry';
import { SessionStore } from './session.store';

/** Exige sessão válida; senão, `/entrar?returnUrl=<url>` (contracts/routes.md). */
export const authGuard: CanActivateFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (session.isAuthenticated() && !session.isExpired()) {
    return true;
  }
  session.clear();
  return router.createUrlTree([LOGIN_PATH], { queryParams: { returnUrl: state.url } });
};
