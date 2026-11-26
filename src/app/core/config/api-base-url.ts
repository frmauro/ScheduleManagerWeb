import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

/** Prefixo da API (`/api/v1`), configurado por ambiente (research R8). */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});
