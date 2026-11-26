import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import type { Address } from '../../core/models/api-models';
import { FieldComponent, FieldControlDirective } from '../ui/field.component';
import { BRAZIL_STATES } from '../ui/select-options';
import { CepDirective } from './cep.directive';
import { PATTERN_MESSAGES } from './validation-messages';
import { SmValidators } from './validators';

export type AddressForm = FormGroup<{
  street: FormControl<string>;
  number: FormControl<string>;
  complement: FormControl<string>;
  district: FormControl<string>;
  city: FormControl<string>;
  state: FormControl<string>;
  postalCode: FormControl<string>;
}>;

/** Subformulário de endereço com as regras do contrato (FR-007). */
export function createAddressForm(initial?: Partial<Address>): AddressForm {
  const text = (value: string | null | undefined, validators: typeof SmValidators.street) =>
    new FormControl(value ?? '', { nonNullable: true, validators });
  return new FormGroup({
    street: text(initial?.street, SmValidators.street),
    number: text(initial?.number, SmValidators.number),
    complement: text(initial?.complement, SmValidators.complement),
    district: text(initial?.district, SmValidators.district),
    city: text(initial?.city, SmValidators.city),
    state: text(initial?.state, SmValidators.state),
    postalCode: text(initial?.postalCode, SmValidators.postalCode),
  });
}

/** Converte o formulário no `Address` da API (`complement` vazio vira `null`). */
export function toAddress(form: AddressForm): Address {
  const v = form.getRawValue();
  return {
    street: v.street.trim(),
    number: v.number.trim(),
    complement: v.complement.trim() || null,
    district: v.district.trim(),
    city: v.city.trim(),
    state: v.state,
    postalCode: v.postalCode,
  };
}

@Component({
  selector: 'sm-address-form',
  standalone: true,
  imports: [ReactiveFormsModule, FieldComponent, FieldControlDirective, CepDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset [formGroup]="group()" class="grid gap-4 sm:grid-cols-6">
      <legend class="sr-only">Endereço</legend>
      <sm-field class="sm:col-span-2" label="CEP" [patternMessage]="patterns.postalCode">
        <input smFieldControl smCep class="sm-input" formControlName="postalCode" />
      </sm-field>
      <sm-field class="sm:col-span-4" label="Rua">
        <input
          smFieldControl
          class="sm-input"
          formControlName="street"
          autocomplete="address-line1"
        />
      </sm-field>
      <sm-field class="sm:col-span-2" label="Número">
        <input smFieldControl class="sm-input" formControlName="number" />
      </sm-field>
      <sm-field class="sm:col-span-4" label="Complemento" [optional]="true">
        <input
          smFieldControl
          class="sm-input"
          formControlName="complement"
          autocomplete="address-line2"
        />
      </sm-field>
      <sm-field class="sm:col-span-3" label="Bairro">
        <input smFieldControl class="sm-input" formControlName="district" />
      </sm-field>
      <sm-field class="sm:col-span-2" label="Cidade">
        <input
          smFieldControl
          class="sm-input"
          formControlName="city"
          autocomplete="address-level2"
        />
      </sm-field>
      <sm-field class="sm:col-span-1" label="UF" [patternMessage]="patterns.state">
        <select
          smFieldControl
          class="sm-select"
          formControlName="state"
          autocomplete="address-level1"
        >
          <option value="" disabled>UF</option>
          @for (uf of states; track uf) {
            <option [value]="uf">{{ uf }}</option>
          }
        </select>
      </sm-field>
    </fieldset>
  `,
})
export class AddressFormComponent {
  readonly group = input.required<AddressForm>();
  protected readonly states = BRAZIL_STATES;
  protected readonly patterns = PATTERN_MESSAGES;
}
