import {
  homeForRole,
  isUrlAllowedForRole,
  resolvePostLoginUrl,
  sanitizeReturnUrl,
} from './return-url';

describe('sanitizeReturnUrl', () => {
  it('aceita caminhos internos', () => {
    expect(sanitizeReturnUrl('/prestadores/abc/agendar?servico=1&horario=x')).toBe(
      '/prestadores/abc/agendar?servico=1&horario=x',
    );
    expect(sanitizeReturnUrl('/cliente/agendamentos')).toBe('/cliente/agendamentos');
  });

  it.each([
    ['https://malicioso.com/cliente'],
    ['//malicioso.com'],
    ['/\\malicioso.com'],
    ['javascript:alert(1)'],
    ['cliente/agendamentos'],
    ['/entrar'],
    ['/entrar?returnUrl=/x'],
    ['/cadastro'],
    ['/cadastro/prestador?etapa=conta'],
    [''],
    [null],
    [undefined],
  ])('rejeita %s', (value) => {
    expect(sanitizeReturnUrl(value)).toBeNull();
  });
});

describe('homeForRole', () => {
  it('leva cada perfil à sua home (routes.md)', () => {
    expect(homeForRole('Customer')).toBe('/cliente/agendamentos');
    expect(homeForRole('Provider')).toBe('/prestador');
    expect(homeForRole('Admin')).toBe('/admin/usuarios');
  });
});

describe('isUrlAllowedForRole', () => {
  it('áreas só para o próprio perfil; públicas para todos', () => {
    expect(isUrlAllowedForRole('/cliente/perfil', 'Customer')).toBe(true);
    expect(isUrlAllowedForRole('/cliente/perfil', 'Provider')).toBe(false);
    expect(isUrlAllowedForRole('/prestador/agenda', 'Provider')).toBe(true);
    expect(isUrlAllowedForRole('/prestador/agenda', 'Admin')).toBe(false);
    expect(isUrlAllowedForRole('/admin/usuarios', 'Admin')).toBe(true);
    expect(isUrlAllowedForRole('/admin/usuarios', 'Customer')).toBe(false);
    expect(isUrlAllowedForRole('/prestadores/abc', 'Admin')).toBe(true);
    expect(isUrlAllowedForRole('/', 'Customer')).toBe(true);
  });

  it('não confunde /prestador com /prestadores', () => {
    expect(isUrlAllowedForRole('/prestadores/abc/agendar', 'Customer')).toBe(true);
    expect(isUrlAllowedForRole('/prestador?x=1', 'Customer')).toBe(false);
  });
});

describe('resolvePostLoginUrl (FR-016)', () => {
  it('prioriza o returnUrl válido e compatível com o perfil', () => {
    expect(resolvePostLoginUrl('/prestadores/abc/agendar?servico=1', 'Customer')).toBe(
      '/prestadores/abc/agendar?servico=1',
    );
  });

  it('cai na home do perfil quando o returnUrl é inválido ou de outro perfil', () => {
    expect(resolvePostLoginUrl('https://x.com', 'Customer')).toBe('/cliente/agendamentos');
    expect(resolvePostLoginUrl('/admin/usuarios', 'Provider')).toBe('/prestador');
    expect(resolvePostLoginUrl(null, 'Admin')).toBe('/admin/usuarios');
  });
});
