import { ChangeDetectionStrategy, Component, inject, signal, type OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidatorFn,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { ProvidersApi } from '../../../core/api/providers.api';
import {
  formatDuration,
  joinMinutes,
  splitMinutes,
  type DurationParts,
} from '../../../core/domain/booking-policy-format';
import { handleFormError } from '../../../core/errors/form-errors';
import { ToastService } from '../../../core/feedback/toast.service';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { BookingPolicy } from '../../../core/models/api-models';
import { multipleOf } from '../../../shared/forms/validators';
import { LOADING, failed, ready, type RemoteState } from '../../../shared/state/remote-state';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../../shared/ui/form-error-summary.component';
import {
  RemoteReadyDirective,
  RemoteViewComponent,
} from '../../../shared/ui/remote-view.component';
import { ProviderSetupStore } from '../setup/provider-setup.store';

const MAX_NOTICE_MINUTES = 10_080;

type DurationForm = FormGroup<{
  days: FormControl<number>;
  hours: FormControl<number>;
  minutes: FormControl<number>;
}>;

const maxTotal: ValidatorFn = (group) => {
  const v = (group as DurationForm).getRawValue();
  return joinMinutes(v) > MAX_NOTICE_MINUTES ? { noticeTooLong: true } : null;
};

function durationForm(total = 0): DurationForm {
  const parts = splitMinutes(total);
  const part = (value: number, max: number) =>
    new FormControl(value, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(max)],
    });
  return new FormGroup(
    { days: part(parts.days, 7), hours: part(parts.hours, 23), minutes: part(parts.minutes, 59) },
    { validators: maxTotal },
  );
}

/**
 * Política de reservas (`/prestador/politica`, FR-039): todos os campos vão no `PUT`; as
 * antecedências são editadas em dias/horas/minutos e valem só para novas reservas.
 */
@Component({
  selector: 'sm-booking-policy-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    FormErrorSummaryComponent,
    RemoteReadyDirective,
    RemoteViewComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-2xl px-4 py-8">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 rounded-md bg-tone-info-bg p-3 text-tone-info-fg" data-testid="policy-notice">
        {{ text.notice }}
      </p>

      <div class="mt-4">
        <sm-remote-view [state]="state()" [skeletonRows]="4" (retry)="load()">
          <ng-template [smRemoteReady]="state()">
            <form
              class="sm-card flex flex-col gap-5"
              [formGroup]="form"
              novalidate
              (ngSubmit)="save()"
            >
              <sm-form-error-summary [messages]="summary()" />

              <div>
                <label class="inline-flex items-center gap-2 font-medium">
                  <input
                    type="checkbox"
                    formControlName="autoConfirm"
                    aria-describedby="sm-auto-confirm-hint"
                  />
                  {{ text.autoConfirm }}
                </label>
                <p id="sm-auto-confirm-hint" class="sm-hint">{{ text.autoConfirmHint }}</p>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <sm-field [label]="text.slotStep" [hint]="text.slotStepHint">
                  <input
                    smFieldControl
                    class="sm-input"
                    type="number"
                    min="5"
                    max="60"
                    step="5"
                    formControlName="slotStepMinutes"
                  />
                </sm-field>
                <sm-field [label]="text.buffer" [hint]="text.bufferHint">
                  <input
                    smFieldControl
                    class="sm-input"
                    type="number"
                    min="0"
                    max="120"
                    step="5"
                    formControlName="bufferMinutes"
                  />
                </sm-field>
              </div>

              @for (notice of notices; track notice.key) {
                <fieldset [formGroupName]="notice.key">
                  <legend class="sm-label">{{ notice.label }}</legend>
                  <div class="grid grid-cols-3 gap-3">
                    <sm-field [label]="text.days">
                      <input
                        smFieldControl
                        class="sm-input"
                        type="number"
                        min="0"
                        max="7"
                        formControlName="days"
                      />
                    </sm-field>
                    <sm-field [label]="text.hours">
                      <input
                        smFieldControl
                        class="sm-input"
                        type="number"
                        min="0"
                        max="23"
                        formControlName="hours"
                      />
                    </sm-field>
                    <sm-field [label]="text.minutes">
                      <input
                        smFieldControl
                        class="sm-input"
                        type="number"
                        min="0"
                        max="59"
                        formControlName="minutes"
                      />
                    </sm-field>
                  </div>
                  <p
                    class="sm-hint"
                    aria-live="polite"
                    [attr.data-testid]="notice.key + '-summary'"
                  >
                    {{ text.currentValue(noticeText(notice.key)) }} · {{ text.noticeHint }}
                  </p>
                  @if (noticeTooLong(notice.key)) {
                    <p class="sm-error" role="alert">{{ text.tooLong }}</p>
                  }
                </fieldset>
              }

              <sm-field [label]="text.horizon" [hint]="text.horizonHint">
                <input
                  smFieldControl
                  class="sm-input"
                  type="number"
                  min="1"
                  max="365"
                  formControlName="bookingHorizonDays"
                />
              </sm-field>

              <div>
                <button type="submit" smButton="primary" [loading]="saving()">
                  {{ text.save }}
                </button>
              </div>
            </form>
          </ng-template>
        </sm-remote-view>
      </div>
    </section>
  `,
})
export class BookingPolicyPageComponent implements OnInit {
  private readonly api = inject(ProvidersApi);
  private readonly toast = inject(ToastService);
  private readonly setup = inject(ProviderSetupStore);

  protected readonly text = PROVIDER_MESSAGES.policy;
  protected readonly notices = [
    { key: 'minBookingNotice', label: this.text.minBookingNotice },
    { key: 'minCancellationNotice', label: this.text.minCancellationNotice },
  ] as const;

  protected readonly form = new FormGroup({
    autoConfirm: new FormControl(false, { nonNullable: true }),
    slotStepMinutes: new FormControl(15, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(5), Validators.max(60), multipleOf(5)],
    }),
    bufferMinutes: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(0), Validators.max(120), multipleOf(5)],
    }),
    minBookingNotice: durationForm(),
    minCancellationNotice: durationForm(),
    bookingHorizonDays: new FormControl(60, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1), Validators.max(365)],
    }),
  });

  private readonly events = toSignal(this.form.events);
  protected readonly state = signal<RemoteState<BookingPolicy>>(LOADING);
  protected readonly saving = signal(false);
  protected readonly summary = signal<string[]>([]);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(LOADING);
    this.api.getMe().subscribe({
      next: (profile) => {
        this.fill(profile.bookingPolicy);
        this.state.set(ready(profile.bookingPolicy));
        this.setup.markPolicyReviewed();
      },
      error: (error: unknown) => this.state.set(failed(error)),
    });
  }

  protected noticeText(key: 'minBookingNotice' | 'minCancellationNotice'): string {
    this.events();
    return formatDuration(joinMinutes(this.partsOf(key)));
  }

  protected noticeTooLong(key: 'minBookingNotice' | 'minCancellationNotice'): boolean {
    this.events();
    return this.form.controls[key].hasError('noticeTooLong');
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const v = this.form.getRawValue();
    const body: BookingPolicy = {
      autoConfirm: v.autoConfirm,
      slotStepMinutes: v.slotStepMinutes,
      bufferMinutes: v.bufferMinutes,
      minBookingNoticeMinutes: joinMinutes(v.minBookingNotice),
      bookingHorizonDays: v.bookingHorizonDays,
      minCancellationNoticeMinutes: joinMinutes(v.minCancellationNotice),
    };
    this.summary.set([]);
    this.saving.set(true);
    this.api
      .updateBookingPolicy(body)
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (saved) => {
          this.fill(saved);
          this.toast.success(this.text.saved);
        },
        error: (error: unknown) => this.summary.set(handleFormError(this.form, error).summary),
      });
  }

  private partsOf(key: 'minBookingNotice' | 'minCancellationNotice'): DurationParts {
    const v = this.form.controls[key].getRawValue();
    return { days: v.days || 0, hours: v.hours || 0, minutes: v.minutes || 0 };
  }

  private fill(policy: BookingPolicy): void {
    this.form.setValue({
      autoConfirm: policy.autoConfirm,
      slotStepMinutes: policy.slotStepMinutes,
      bufferMinutes: policy.bufferMinutes,
      minBookingNotice: splitMinutes(policy.minBookingNoticeMinutes),
      bookingHorizonDays: policy.bookingHorizonDays,
      minCancellationNotice: splitMinutes(policy.minCancellationNoticeMinutes),
    });
    this.form.markAsPristine();
  }
}
