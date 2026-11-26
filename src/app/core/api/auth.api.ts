import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { SKIP_SESSION_401 } from '../http/http-contexts';
import type {
  AuthResponse,
  CurrentUser,
  LoginRequest,
  RegisterCustomerRequest,
  RegisterProviderRequest,
} from '../models/api-models';
import { API } from './endpoints';

/** Autenticação: operações #1–#4 (contracts/api-services.md). */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  /** #1 — `201`; `409 user.email_taken` → erro no campo `email`. */
  registerCustomer(body: RegisterCustomerRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(API.auth.registerCustomer, body);
  }

  /** #2 — `201`; mesmo `409` do cadastro de cliente. */
  registerProvider(body: RegisterProviderRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(API.auth.registerProvider, body);
  }

  /** #3 — `401 auth.invalid_credentials` não é sessão expirada. */
  login(body: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(API.auth.login, body, {
      context: new HttpContext().set(SKIP_SESSION_401, true),
    });
  }

  /** #4 — valida a sessão restaurada na inicialização (FR-018). */
  me(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>(API.auth.me);
  }
}
