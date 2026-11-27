import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../../core/api/auth.api';
import { AuthFlowService } from '../../core/auth/auth-flow.service';
import { sanitizeReturnUrl } from '../../core/auth/return-url';
import { APP_PATHS } from '../../core/config/app-paths';
import { AUTH_MESSAGES } from '../../core/i18n/auth.messages';
import { PhoneBrDirective } from '../../shared/forms/phone-br.directive';
import { PATTERN_MESSAGES } from '../../shared/forms/validation-messages';
import { SmValidators } from '../../shared/forms/validators';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../shared/ui/form-error-summary.component';
import { handleAuthFormError } from './auth-form-errors';

/** Cadastro de cliente (`/cadastro`, FR-013): já entra autenticado e segue para o destino. */
@Component({
  selector: 'sm-register-customer-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    FormErrorSummaryComponent,
    PhoneBrDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-10">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 text-gray-700">{{ text.intro }}</p>

      <form
        class="sm-card mt-6 flex flex-col gap-4"
        [formGroup]="form"
        (ngSubmit)="submit()"
        novalidate
      >
        <sm-form-error-summary [messages]="summary()" />
        <sm-field [label]="fields.name">
          <input smFieldControl class="sm-input" formControlName="name" autocomplete="name" />
        </sm-field>
        <sm-field [label]="fields.email">
          <input
            smFieldControl
            class="sm-input"
            type="email"
            formControlName="email"
            autocomplete="email"
          />
        </sm-field>
        <sm-field [label]="fields.password" [hint]="fields.passwordHint">
          <input
            smFieldControl
            class="sm-input"
            type="password"
            formControlName="password"
            autocomplete="new-password"
          />
        </sm-field>
        <sm-field
          [label]="fields.phone"
          [hint]="fields.phoneHint"
          [patternMessage]="patterns.phone"
        >
          <input
            smFieldControl
            smPhoneBr
            class="sm-input"
            type="tel"
            formControlName="phone"
            autocomplete="tel"
          />
        </sm-field>
        <button type="submit" smButton [loading]="submitting()">{{ text.submit }}</button>
      </form>

      <p class="mt-6 text-sm text-gray-700">
        {{ text.hasAccount }}
        <a class="sm-link" [routerLink]="loginPath" [queryParams]="returnQuery()">{{
          text.login
        }}</a>
      </p>
      <p class="mt-2 text-sm">
        <a class="sm-link" [routerLink]="providerPath">{{ text.providerLink }}</a>
      </p>
    </section>
  `,
})
export class RegisterCustomerPageComponent {
  readonly returnUrl = input<string>();

  private readonly authApi = inject(AuthApi);
  private readonly flow = inject(AuthFlowService);

  protected readonly text = AUTH_MESSAGES.registerCustomer;
  protected readonly fields = AUTH_MESSAGES.fields;
  protected readonly patterns = PATTERN_MESSAGES;
  protected readonly loginPath = APP_PATHS.login;
  protected readonly providerPath = APP_PATHS.registerProvider;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: SmValidators.name }),
    email: new FormControl('', { nonNullable: true, validators: SmValidators.email }),
    password: new FormControl('', { nonNullable: true, validators: SmValidators.password }),
    phone: new FormControl('', { nonNullable: true, validators: SmValidators.phone }),
  });

  protected readonly submitting = signal(false);
  protected readonly summary = signal<string[]>([]);
  protected readonly returnQuery = computed(() => {
    const safe = sanitizeReturnUrl(this.returnUrl());
    return safe ? { returnUrl: safe } : {};
  });

  protected submit(): void {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.summary.set([]);
    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.authApi
      .registerCustomer({
        name: v.name.trim(),
        email: v.email.trim(),
        password: v.password,
        phone: v.phone,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (auth) => void this.flow.complete(auth, this.returnUrl()),
        error: (error: unknown) => this.summary.set(handleAuthFormError(this.form, error).summary),
      });
  }
}
