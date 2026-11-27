import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../../core/api/auth.api';
import { AuthFlowService } from '../../core/auth/auth-flow.service';
import { sanitizeReturnUrl } from '../../core/auth/return-url';
import { SESSION_EXPIRED_REASON } from '../../core/auth/session-expiry';
import { APP_PATHS } from '../../core/config/app-paths';
import { AUTH_MESSAGES } from '../../core/i18n/auth.messages';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../shared/ui/form-error-summary.component';
import { handleAuthFormError } from './auth-form-errors';

/**
 * Login (`/entrar`, FR-016). `401 auth.invalid_credentials` é uma mensagem genérica no
 * formulário, nunca o fluxo de sessão expirada; depois do login, volta ao `returnUrl`.
 */
@Component({
  selector: 'sm-login-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    FormErrorSummaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-10">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 text-gray-700">{{ text.intro }}</p>

      @if (expired()) {
        <p
          class="mt-4 rounded-md border border-tone-warning-fg bg-tone-warning-bg p-3 text-sm font-medium text-tone-warning-fg"
          role="status"
        >
          {{ expiredText }}
        </p>
      }

      <form
        class="sm-card mt-6 flex flex-col gap-4"
        [formGroup]="form"
        (ngSubmit)="submit()"
        novalidate
      >
        <sm-form-error-summary [messages]="summary()" [title]="''" />
        <sm-field [label]="fields.email">
          <input
            smFieldControl
            class="sm-input"
            type="email"
            formControlName="email"
            autocomplete="email"
          />
        </sm-field>
        <sm-field [label]="fields.password">
          <input
            smFieldControl
            class="sm-input"
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
        </sm-field>
        <button type="submit" smButton [loading]="submitting()">{{ text.submit }}</button>
      </form>

      <p class="mt-6 text-sm text-gray-700">
        {{ text.noAccount }}
        <a class="sm-link" [routerLink]="registerPath" [queryParams]="returnQuery()">{{
          text.createAccount
        }}</a>
        ·
        <a class="sm-link" [routerLink]="providerPath">{{ text.iAmProvider }}</a>
      </p>
    </section>
  `,
})
export class LoginPageComponent {
  /** Query params (`withComponentInputBinding`). */
  readonly returnUrl = input<string>();
  readonly motivo = input<string>();

  private readonly authApi = inject(AuthApi);
  private readonly flow = inject(AuthFlowService);

  protected readonly text = AUTH_MESSAGES.login;
  protected readonly fields = AUTH_MESSAGES.fields;
  protected readonly expiredText = COMMON_MESSAGES.session.expired;
  protected readonly registerPath = APP_PATHS.registerCustomer;
  protected readonly providerPath = APP_PATHS.registerProvider;

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly submitting = signal(false);
  protected readonly summary = signal<string[]>([]);
  protected readonly expired = computed(() => this.motivo() === SESSION_EXPIRED_REASON);
  /** "Criar conta" preserva o destino (ex.: a reserva em andamento). */
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
    const { email, password } = this.form.getRawValue();
    this.authApi
      .login({ email: email.trim(), password })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (auth) => void this.flow.complete(auth, this.returnUrl()),
        error: (error: unknown) => this.summary.set(handleAuthFormError(this.form, error).summary),
      });
  }
}
