import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  UrlTree,
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type RouterStateSnapshot,
} from '@angular/router';
import type { Role } from '../models/enums';
import { authGuard } from './auth.guard';
import { guestGuard } from './guest.guard';
import { roleGuard } from './role.guard';
import { SessionStore } from './session.store';

function run(guard: CanActivateFn, url: string): ReturnType<CanActivateFn> {
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

function serialize(result: ReturnType<CanActivateFn>): string | boolean {
  if (result instanceof UrlTree) {
    return TestBed.inject(Router).serializeUrl(result);
  }
  return result as boolean;
}

describe('guards funcionais', () => {
  let session: SessionStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    session = TestBed.inject(SessionStore);
  });

  function loginAs(role: Role, expiresInMs = 3_600_000): void {
    session.start({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
      user: { id: 'u', name: 'X', email: 'x@x.com', role },
    });
  }

  it('authGuard sem sessão → /entrar?returnUrl=<url>', () => {
    expect(serialize(run(authGuard, '/cliente/perfil'))).toBe(
      '/entrar?returnUrl=%2Fcliente%2Fperfil',
    );
  });

  it('authGuard com sessão expirada → limpa e redireciona', () => {
    loginAs('Customer', -1);
    expect(serialize(run(authGuard, '/cliente/perfil'))).toBe(
      '/entrar?returnUrl=%2Fcliente%2Fperfil',
    );
    expect(session.isAuthenticated()).toBe(false);
  });

  it('authGuard com sessão válida → permite', () => {
    loginAs('Customer');
    expect(run(authGuard, '/cliente/perfil')).toBe(true);
  });

  it('roleGuard("Provider") com Customer → /sem-permissao', () => {
    loginAs('Customer');
    expect(serialize(run(roleGuard('Provider'), '/prestador/agenda'))).toBe('/sem-permissao');
  });

  it('roleGuard("Provider") com Provider → permite', () => {
    loginAs('Provider');
    expect(run(roleGuard('Provider'), '/prestador/agenda')).toBe(true);
  });

  it('guestGuard com sessão → home do perfil', () => {
    loginAs('Admin');
    expect(serialize(run(guestGuard, '/entrar'))).toBe('/admin/usuarios');
  });

  it('guestGuard sem sessão → permite', () => {
    expect(run(guestGuard, '/entrar')).toBe(true);
  });
});
