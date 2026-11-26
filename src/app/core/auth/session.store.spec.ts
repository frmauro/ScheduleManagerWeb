import { TestBed } from '@angular/core/testing';
import type { AuthResponse } from '../models/api-models';
import { STORAGE_KEYS } from '../config/app.constants';
import { SessionStore } from './session.store';

const NOW = new Date('2026-12-01T12:00:00Z').getTime();

function authResponse(expiresInMinutes = 60): AuthResponse {
  return {
    accessToken: 'token-abc',
    tokenType: 'Bearer',
    expiresAt: new Date(NOW + expiresInMinutes * 60_000).toISOString(),
    user: { id: 'u1', name: 'Ana', email: 'ana@exemplo.com', role: 'Customer', customerId: 'c1' },
  };
}

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(SessionStore);
  });

  afterEach(() => vi.useRealTimers());

  it('start() grava em memória e em sessionStorage["sm.session"]', () => {
    store.start(authResponse());
    expect(store.isAuthenticated()).toBe(true);
    expect(store.role()).toBe('Customer');
    expect(store.accessToken()).toBe('token-abc');
    const raw = sessionStorage.getItem(STORAGE_KEYS.session);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '{}').accessToken).toBe('token-abc');
  });

  it('restore() recupera uma sessão válida', () => {
    store.start(authResponse());
    const other = TestBed.runInInjectionContext(() => new SessionStore());
    expect(other.restore()).not.toBeNull();
    expect(other.user()?.name).toBe('Ana');
  });

  it('restore() descarta sessão expirada (now ≥ expiresAt)', () => {
    store.start(authResponse(60));
    vi.setSystemTime(NOW + 60 * 60_000);
    const other = TestBed.runInInjectionContext(() => new SessionStore());
    expect(other.restore()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('restore() descarta JSON inválido ou com formato errado', () => {
    sessionStorage.setItem(STORAGE_KEYS.session, '{não é json');
    expect(store.restore()).toBeNull();
    sessionStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ accessToken: 1 }));
    expect(store.restore()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('isExpired e warningAt = expiresAt − 5 min', () => {
    store.start(authResponse(60));
    expect(store.isExpired()).toBe(false);
    expect(store.warningAt()).toBe(NOW + 55 * 60_000);
    vi.setSystemTime(NOW + 60 * 60_000);
    expect(store.isExpired()).toBe(true);
  });

  it('clear() apaga memória e storage', () => {
    store.start(authResponse());
    store.clear();
    expect(store.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(STORAGE_KEYS.session)).toBeNull();
  });

  it('o aviso é marcado uma vez por sessão e zera numa nova sessão', () => {
    store.start(authResponse());
    expect(store.warned()).toBe(false);
    store.markWarned();
    expect(store.warned()).toBe(true);
    store.start(authResponse());
    expect(store.warned()).toBe(false);
  });

  it('nunca escreve o token no console', () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => undefined),
    );
    store.start(authResponse());
    store.restore();
    store.clear();
    for (const spy of spies) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain('token-abc');
      }
    }
  });
});
