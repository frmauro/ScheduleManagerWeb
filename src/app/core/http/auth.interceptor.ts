import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { SessionStore } from '../auth/session.store';
import { API_BASE_URL } from '../config/api-base-url';

/** Adiciona `Authorization: Bearer` apenas em chamadas à própria API e com sessão. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(SessionStore).accessToken();
  const base = inject(API_BASE_URL);
  if (!token || !req.url.startsWith(`${base}/`)) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
