import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SessionStore } from './core/auth/session.store';
import { AppComponent } from './app.component';

describe('AppComponent (shell)', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('tem link de salto, cabeçalho e conteúdo principal', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href="#conteudo"]')?.textContent).toContain('Pular para o conteúdo');
    expect(el.querySelector('sm-app-header')).not.toBeNull();
    expect(el.querySelector('main#conteudo router-outlet')).not.toBeNull();
  });

  it('visitante vê Buscar, Entrar, Cadastrar-se e "Sou prestador"', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map(
      (a) => a.textContent?.trim(),
    );
    expect(links).toEqual(['Buscar', 'Entrar', 'Cadastrar-se', 'Sou prestador']);
  });

  it('prestador vê só os links da sua área e o botão Sair', () => {
    TestBed.inject(SessionStore).start({
      accessToken: 't',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      user: { id: 'u', name: 'Bruno', email: 'b@x.com', role: 'Provider', providerId: 'p1' },
    });
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const links = Array.from(el.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(links).toContain('Agenda');
    expect(links).not.toContain('Meus agendamentos');
    expect(links).not.toContain('Usuários');
    expect(el.textContent).toContain('Sair');
  });
});
