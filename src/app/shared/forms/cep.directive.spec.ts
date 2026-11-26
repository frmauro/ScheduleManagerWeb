import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CepDirective } from './cep.directive';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, CepDirective],
  template: `<input smCep [formControl]="cep" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {
  readonly cep = new FormControl<string>('', { nonNullable: true });
}

describe('smCep', () => {
  it('exibe 00000-000 e grava 8 dígitos', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '01001000';
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('01001-000');
    expect(fixture.componentInstance.cep.value).toBe('01001000');
  });

  it('ignora caracteres extras e limita a 8 dígitos', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '01.001-000999';
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('01001-000');
    expect(fixture.componentInstance.cep.value).toBe('01001000');
  });

  it('writeValue formata o valor do modelo', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.cep.setValue('20040002');
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('20040-002');
  });
});
