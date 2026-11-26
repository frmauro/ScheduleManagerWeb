import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import type { Role } from '../models/enums';
import { SessionStore } from './session.store';

export const FORBIDDEN_PATH = '/sem-permissao';

/** Exige o perfil indicado; senão, `/sem-permissao` (FR-020). Use depois do `authGuard`. */
export function roleGuard(role: Role): CanActivateFn {
  return () => {
    const session = inject(SessionStore);
    return session.role() === role ? true : inject(Router).createUrlTree([FORBIDDEN_PATH]);
  };
}
