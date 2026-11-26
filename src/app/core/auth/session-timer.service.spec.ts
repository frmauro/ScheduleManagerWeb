import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SessionStore } from './session.store';
import { SessionTimerService } from './session-timer.service';

const NOW = new Date('2026-12-01T12:00:00Z').getTime();
const MIN = 60_000;

describe('SessionTimerService (FR-017, FR-017a)', () => {
  let timer: SessionTimerService;
  let session: SessionStore;
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    navigate.mockClear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { url: '/prestador/expediente', navigate } }],
    });
    timer = TestBed.inject(SessionTimerService);
    session = TestBed.inject(SessionStore);
    session.start({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresAt: new Date(NOW + 60 * MIN).toISOString(),
      user: { id: 'u', name: 'P', email: 'p@x.com', role: 'Provider' },
    });
    timer.schedule();
  });

  afterEach(() => {
    timer.cancel();
    vi.useRealTimers();
  });

  it('mostra o aviso aos expiresAt − 5 min, uma única vez', () => {
    vi.advanceTimersByTime(55 * MIN - 1);
    expect(timer.warningVisible()).toBe(false);
    vi.advanceTimersByTime(1);
    expect(timer.warningVisible()).toBe(true);
    expect(session.warned()).toBe(true);

    timer.dismissWarning();
    timer.schedule();
    vi.advanceTimersByTime(MIN);
    expect(timer.warningVisible()).toBe(false);
  });

  it('o aviso não renova a sessão', () => {
    const expiresBefore = session.expiresAtMs();
    vi.advanceTimersByTime(55 * MIN);
    expect(session.expiresAtMs()).toBe(expiresBefore);
  });

  it('em expiresAt limpa a sessão e leva ao login com returnUrl e motivo', () => {
    vi.advanceTimersByTime(60 * MIN);
    expect(session.isAuthenticated()).toBe(false);
    expect(timer.warningVisible()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/entrar'], {
      queryParams: { returnUrl: '/prestador/expediente', motivo: 'sessao-expirada' },
    });
  });

  it('cancel() impede os disparos (ex.: "Sair")', () => {
    timer.cancel();
    session.clear();
    vi.advanceTimersByTime(61 * MIN);
    expect(timer.warningVisible()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('se a sessão já foi limpa (401), a expiração não navega de novo', () => {
    session.clear();
    vi.advanceTimersByTime(61 * MIN);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sessão restaurada já dentro dos 5 min finais mostra o aviso imediatamente', () => {
    timer.cancel();
    vi.setSystemTime(NOW + 57 * MIN);
    timer.schedule();
    vi.advanceTimersByTime(0);
    expect(timer.warningVisible()).toBe(true);
  });
});
