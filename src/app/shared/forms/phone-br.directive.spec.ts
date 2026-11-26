import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { PhoneBrDirective } from './phone-br.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, PhoneBrDirective],
  template: `<input smPhoneBr [formControl]="phone" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly phone = new FormControl<string>('', { nonNullable: true });
}

function setup() {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();
  const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
  const type = (text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  return { fixture, input, type, control: fixture.componentInstance.phone };
}

describe('smPhoneBr', () => {
  it('exibe (11) 99999-8888 e grava +5511999998888 (celular)', () => {
    const { input, type, control } = setup();
    type('11999998888');
    expect(input.value).toBe('(11) 99999-8888');
    expect(control.value).toBe('+5511999998888');
    expect(control.valid).toBe(true);
  });

  it('aceita fixo de 8 dígitos: (11) 3333-4444 → +551133334444', () => {
    const { input, type, control } = setup();
    type('(11) 3333-4444');
    expect(input.value).toBe('(11) 3333-4444');
    expect(control.value).toBe('+551133334444');
  });

  it('número incompleto fica inválido', () => {
    const { type, control } = setup();
    type('1199');
    expect(control.errors).toEqual({ phone: true });
  });

  it('writeValue em E.164 brasileiro exibe formatado', () => {
    const { fixture, input, control } = setup();
    control.setValue('+5521988887777');
    fixture.detectChanges();
    expect(input.value).toBe('(21) 98888-7777');
  });

  it('número estrangeiro vindo da API é exibido como está', () => {
    const { fixture, input, control } = setup();
    control.setValue('+14155552671');
    fixture.detectChanges();
    expect(input.value).toBe('+14155552671');
    expect(control.valid).toBe(true);
  });

  it('campo vazio grava string vazia', () => {
    const { type, control } = setup();
    type('');
    expect(control.value).toBe('');
  });
});
