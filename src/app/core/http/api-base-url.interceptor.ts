import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { API_BASE_URL } from '../config/api-base-url';

/** Prefixa `/api/v1` nos caminhos relativos da API (`/providers` → `/api/v1/providers`). */
export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  const isRelativePath = req.url.startsWith('/') && !req.url.startsWith('//');
  if (!isRelativePath || req.url.startsWith(`${base}/`)) {
    return next(req);
  }
  return next(req.clone({ url: `${base}${req.url}` }));
};
