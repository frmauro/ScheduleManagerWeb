import { HttpErrorResponse, HttpStatusCode, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../feedback/toast.service';
import { navigateToLoginExpired } from '../auth/session-expiry';
import { SessionStore } from '../auth/session.store';
import { toApiError } from '../errors/api-error';
import { ERROR_MESSAGES } from '../errors/error-messages';
import { SKIP_ERROR_TOAST, SKIP_SESSION_401 } from './http-contexts';

/**
 * Normaliza `HttpErrorResponse` em `ApiError` (research R8) e trata o que é transversal:
 * - `401`: limpa a sessão e leva ao login com `returnUrl` (FR-017);
 * - `403`: toast "Você não tem permissão para esta ação." (FR-020).
 * Não há nova tentativa automática: só a reserva é reenviada, com a mesma Idempotency-Key.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(SessionStore);
  const router = inject(Router);
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      const apiError = toApiError(err);
      if (err.status === HttpStatusCode.Unauthorized && !req.context.get(SKIP_SESSION_401)) {
        session.clear();
        void navigateToLoginExpired(router);
      } else if (err.status === HttpStatusCode.Forbidden && !req.context.get(SKIP_ERROR_TOAST)) {
        toast.error(ERROR_MESSAGES['auth.forbidden'].message);
      }
      return throwError(() => apiError);
    }),
  );
};
