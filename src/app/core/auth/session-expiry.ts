import type { Router } from '@angular/router';
import { sanitizeReturnUrl } from './return-url';

/** Valor de `motivo` no login quando a sessão expirou (contracts/routes.md). */
export const SESSION_EXPIRED_REASON = 'sessao-expirada';
export const LOGIN_PATH = '/entrar';

/**
 * Leva ao login preservando a página atual (FR-017, SC-010).
 * Usado pelo `errorInterceptor` (401) e pelo `SessionTimerService` (expiração local).
 */
export function navigateToLoginExpired(router: Router): Promise<boolean> {
  const returnUrl = sanitizeReturnUrl(router.url);
  return router.navigate([LOGIN_PATH], {
    queryParams: {
      ...(returnUrl ? { returnUrl } : {}),
      motivo: SESSION_EXPIRED_REASON,
    },
  });
}
