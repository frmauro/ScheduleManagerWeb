import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { homeForRole } from './return-url';
import { SessionStore } from './session.store';

/** Usuário autenticado em `/entrar` ou `/cadastro*` vai para a home do seu perfil. */
export const guestGuard: CanActivateFn = () => {
  const session = inject(SessionStore);
  const role = session.role();
  if (role === null || session.isExpired()) {
    return true;
  }
  return inject(Router).createUrlTree([homeForRole(role)]);
};
