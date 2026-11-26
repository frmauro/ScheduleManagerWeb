import { FormControl, FormGroup } from '@angular/forms';
import { applyFieldError, applyServerErrors, SERVER_ERROR_KEY } from './form-errors';

function buildForm() {
  return new FormGroup({
    email: new FormControl(''),
    address: new FormGroup({
      city: new FormControl(''),
      postalCode: new FormControl(''),
    }),
  });
}

describe('applyServerErrors', () => {
  it('põe o erro no controle pelo caminho pontuado e o marca como tocado', () => {
    const form = buildForm();
    const unmatched = applyServerErrors(form, {
      'address.city': ['A cidade é obrigatória.'],
      email: ['E-mail inválido.', 'Outro.'],
    });
    const city = form.get('address.city');
    expect(city?.errors?.[SERVER_ERROR_KEY]).toBe('A cidade é obrigatória.');
    expect(city?.touched).toBe(true);
    expect(form.get('email')?.errors?.[SERVER_ERROR_KEY]).toBe('E-mail inválido.');
    expect(unmatched).toEqual([]);
  });

  it('devolve as mensagens sem controle correspondente para o resumo', () => {
    const form = buildForm();
    const unmatched = applyServerErrors(form, { startAt: ['Horário inválido.'] });
    expect(unmatched).toEqual(['Horário inválido.']);
  });

  it('o erro do servidor some quando o usuário altera o valor', () => {
    const form = buildForm();
    applyServerErrors(form, { email: ['E-mail inválido.'] });
    form.get('email')?.setValue('novo@exemplo.com');
    expect(form.get('email')?.errors).toBeNull();
  });
});

describe('applyFieldError', () => {
  it('marca um campo específico (ex.: 409 user.email_taken)', () => {
    const form = buildForm();
    const applied = applyFieldError(form, 'email', 'Este e-mail já está em uso.');
    expect(applied).toBe(true);
    expect(form.get('email')?.errors?.[SERVER_ERROR_KEY]).toBe('Este e-mail já está em uso.');
  });

  it('retorna false se o campo não existe', () => {
    expect(applyFieldError(buildForm(), 'inexistente', 'x')).toBe(false);
  });
});
