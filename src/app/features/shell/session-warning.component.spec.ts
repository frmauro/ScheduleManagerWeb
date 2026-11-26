import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SessionStore } from '../../core/auth/session.store';
import { SessionTimerService } from '../../core/auth/session-timer.service';
import { SessionWarningComponent } from './session-warning.component';

const NOW = new Date('2026-12-01T12:00:00Z').getTime();
const MIN = 60_000;

describe('sm-session-warning (FR-017a)', () => {
  const navigate = vi.fn().mockResolvedValue(true);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    navigate.mockClear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { url: '/prestador/expediente', navigate } }],
    });
    TestBed.inject(SessionStore).start({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresAt: new Date(NOW + 60 * MIN).toISOString(),
      user: { id: 'u', name: 'P', email: 'p@x.com', role: 'Provider' },
    });
    TestBed.inject(SessionTimerService).schedule();
  });

  afterEach(() => {
    TestBed.inject(SessionTimerService).cancel();
    vi.useRealTimers();
  });

  function render() {
    const fixture = TestBed.createComponent(SessionWarningComponent);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('fica oculto antes dos 55 min, mas a região aria-live já existe', () => {
    const { el } = render();
    expect(el.querySelector('[aria-live="polite"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="session-warning"]')).toBeNull();
  });

  it('aos 55 min mostra o texto do aviso', () => {
    const { fixture, el } = render();
    vi.advanceTimersByTime(55 * MIN);
    fixture.detectChanges();
    expect(el.textContent).toContain('Sua sessão expira em 5 min — salve seu trabalho.');
  });

  it('"Entrar novamente" descarta a sessão e vai ao login preservando a página', () => {
    const { fixture, el } = render();
    vi.advanceTimersByTime(55 * MIN);
    fixture.detectChanges();
    const button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Entrar novamente'),
    );
    button?.click();
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/entrar'], {
      queryParams: { returnUrl: '/prestador/expediente' },
    });
  });

  it('fechar o aviso não renova a sessão', () => {
    const { fixture, el } = render();
    vi.advanceTimersByTime(55 * MIN);
    fixture.detectChanges();
    (el.querySelector('button[aria-label="Fechar"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="session-warning"]')).toBeNull();
    expect(TestBed.inject(SessionStore).isAuthenticated()).toBe(true);
  });
});
