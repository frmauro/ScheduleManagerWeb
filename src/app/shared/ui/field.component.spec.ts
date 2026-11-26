import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { applyServerErrors } from '../../core/errors/form-errors';
import { SmValidators } from '../forms/validators';
import { FieldComponent, FieldControlDirective } from './field.component';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, FieldComponent, FieldControlDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form">
      <sm-field label="E-mail" hint="Usaremos para avisos.">
        <input smFieldControl class="sm-input" formControlName="email" />
      </sm-field>
    </form>
  `,
})
class HostComponent {
  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: SmValidators.email }),
  });
}

describe('sm-field + smFieldControl', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const label = el.querySelector('label') as HTMLLabelElement;
    return { fixture, el, input, label };
  }

  it('liga o rótulo ao controle e descreve pela dica', () => {
    const { input, label } = setup();
    expect(label.htmlFor).toBe(input.id);
    expect(input.getAttribute('aria-describedby')).toContain('-hint');
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('mostra o erro só depois de tocado, com aria-invalid e aria-describedby', async () => {
    const { fixture, el, input } = setup();
    expect(el.querySelector('.sm-error')).toBeNull();
    fixture.componentInstance.form.markAllAsTouched();
    await fixture.whenStable();
    fixture.detectChanges();
    const error = el.querySelector('.sm-error');
    expect(error?.textContent).toContain('Campo obrigatório.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toContain(error?.id ?? 'x');
  });

  it('exibe a mensagem do servidor (400 validation.failed)', async () => {
    const { fixture, el } = setup();
    applyServerErrors(fixture.componentInstance.form, { email: ['Este e-mail já está em uso.'] });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('.sm-error')?.textContent).toContain('Este e-mail já está em uso.');
  });
});
