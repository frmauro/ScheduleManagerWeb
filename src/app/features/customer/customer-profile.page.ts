import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { finalize, startWith, Subject, switchMap, tap } from 'rxjs';
import { CustomersApi } from '../../core/api/customers.api';
import { SessionStore } from '../../core/auth/session.store';
import { handleFormError } from '../../core/errors/form-errors';
import { ToastService } from '../../core/feedback/toast.service';
import { AUTH_MESSAGES } from '../../core/i18n/auth.messages';
import { CUSTOMER_MESSAGES } from '../../core/i18n/customer.messages';
import type { CustomerProfile } from '../../core/models/api-models';
import { PhoneBrDirective } from '../../shared/forms/phone-br.directive';
import { PATTERN_MESSAGES } from '../../shared/forms/validation-messages';
import { SmValidators } from '../../shared/forms/validators';
import { LOADING, toRemoteState, type RemoteState } from '../../shared/state/remote-state';
import { formatInZone, browserTimeZone } from '../../shared/time/zoned-time';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../shared/ui/form-error-summary.component';
import { RemoteReadyDirective, RemoteViewComponent } from '../../shared/ui/remote-view.component';

/**
 * Meu perfil (`/cliente/perfil`, FR-036): nome (2–120), e-mail (≤ 254) e telefone E.164;
 * `409 user.email_taken` vai para o campo e-mail; o nome novo aparece no cabeçalho.
 */
@Component({
  selector: 'sm-customer-profile-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    FormErrorSummaryComponent,
    PhoneBrDirective,
    RemoteReadyDirective,
    RemoteViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-md px-4 py-8">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 text-gray-700">{{ text.intro }}</p>

      <div class="mt-6">
        <sm-remote-view [state]="state()" [skeletonRows]="4" (retry)="reload()">
          <ng-template [smRemoteReady]="state()" let-profile>
            <form
              class="sm-card flex flex-col gap-4"
              [formGroup]="form"
              novalidate
              (ngSubmit)="save()"
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
              <button type="submit" smButton [loading]="saving()">
                {{ saving() ? text.saving : text.save }}
              </button>
              <p class="sm-hint">{{ memberSince(profile) }}</p>
            </form>
          </ng-template>
        </sm-remote-view>
      </div>
    </section>
  `,
})
export class CustomerProfilePageComponent {
  private readonly api = inject(CustomersApi);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(ToastService);
  private readonly reload$ = new Subject<void>();

  protected readonly text = CUSTOMER_MESSAGES.profile;
  protected readonly fields = AUTH_MESSAGES.fields;
  protected readonly patterns = PATTERN_MESSAGES;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: SmValidators.name }),
    email: new FormControl('', { nonNullable: true, validators: SmValidators.email }),
    phone: new FormControl('', { nonNullable: true, validators: SmValidators.phone }),
  });

  protected readonly saving = signal(false);
  protected readonly summary = signal<string[]>([]);

  protected readonly state = toSignal(
    this.reload$.pipe(
      startWith(undefined),
      switchMap(() => toRemoteState(this.api.getMe().pipe(tap((p) => this.fill(p))), () => false)),
    ),
    { initialValue: LOADING as RemoteState<CustomerProfile> },
  );

  protected save(): void {
    if (this.saving()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.summary.set([]);
    this.saving.set(true);
    this.api
      .updateMe({ name: v.name.trim(), email: v.email.trim(), phone: v.phone })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (profile) => {
          this.fill(profile);
          const user = this.session.user();
          if (user) {
            this.session.updateUser({ ...user, name: profile.name, email: profile.email });
          }
          this.toast.success(this.text.saved);
        },
        error: (error: unknown) =>
          this.summary.set(
            handleFormError(this.form, error, { 'user.email_taken': 'email' }).summary,
          ),
      });
  }

  protected memberSince(profile: CustomerProfile): string {
    return this.text.memberSince(formatInZone(profile.createdAt, browserTimeZone(), 'date'));
  }

  protected reload(): void {
    this.reload$.next();
  }

  private fill(profile: CustomerProfile): void {
    this.form.reset({ name: profile.name, email: profile.email, phone: profile.phone });
  }
}
