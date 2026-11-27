import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { ScheduleApi } from '../../../core/api/schedule.api';
import { EXCEPTION_MAX_PERIOD_DAYS } from '../../../core/config/app.constants';
import { handleFormError } from '../../../core/errors/form-errors';
import { COMMON_MESSAGES } from '../../../core/i18n/common.messages';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type {
  ScheduleExceptionCreated,
  ScheduleExceptionRequest,
} from '../../../core/models/api-models';
import {
  SCHEDULE_EXCEPTION_TYPE_VALUES,
  type ScheduleExceptionType,
} from '../../../core/models/enums';
import { SCHEDULE_EXCEPTION_TYPE_LABELS } from '../../../core/models/labels';
import { PATTERN_MESSAGES } from '../../../shared/forms/validation-messages';
import { exceptionPeriod } from '../../../shared/forms/validators';
import { todayInZone } from '../../../shared/time/zoned-time';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../../shared/ui/form-error-summary.component';

export interface ExceptionFormDialogData {
  /** Fuso do prestador: "hoje" é calculado nele. */
  readonly timeZoneId: string;
}

export const EXCEPTION_FORM_TITLE_ID = 'sm-exception-form-title';

const LOCAL_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** `startDate ≥ hoje` no fuso do prestador. */
function notBefore(today: string): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    return typeof value === 'string' && value !== '' && value < today ? { dateInPast: true } : null;
  };
}

/**
 * Horas da exceção: as duas ou nenhuma; obrigatórias em `SpecialHours`; início < fim. O erro
 * fica no grupo e aparece no campo "Hora final".
 */
const exceptionTimes: ValidatorFn = (group): ValidationErrors | null => {
  const type: unknown = group.get('type')?.value;
  const start: unknown = group.get('startTime')?.value;
  const end: unknown = group.get('endTime')?.value;
  const hasStart = typeof start === 'string' && start !== '';
  const hasEnd = typeof end === 'string' && end !== '';
  if (type === 'SpecialHours' && (!hasStart || !hasEnd)) {
    return { timesRequired: true };
  }
  if (hasStart !== hasEnd) {
    return { timesPair: true };
  }
  if (hasStart && hasEnd && (start as string) >= (end as string)) {
    return { timeRange: true };
  }
  return null;
};

/**
 * Nova exceção (FR-042): fechamento (dia inteiro ou trecho) ou horário especial. Período de até
 * 366 dias, a partir de hoje no fuso do prestador. Sucesso fecha com os agendamentos afetados.
 */
@Component({
  selector: 'sm-exception-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    FormErrorSummaryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <h2 [id]="titleId" class="mb-3">{{ text.title }}</h2>
    <form class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="save()">
      <sm-form-error-summary [messages]="summary()" />
      <sm-field [label]="text.type" [hint]="typeHint()">
        <select smFieldControl class="sm-select" formControlName="type">
          @for (type of types; track type) {
            <option [value]="type">{{ typeLabels[type] }}</option>
          }
        </select>
      </sm-field>
      <div class="grid gap-4 sm:grid-cols-2">
        <sm-field [label]="text.startDate">
          <input
            smFieldControl
            class="sm-input"
            type="date"
            [min]="today"
            formControlName="startDate"
          />
        </sm-field>
        <sm-field [label]="text.endDate">
          <input
            smFieldControl
            class="sm-input"
            type="date"
            [min]="today"
            formControlName="endDate"
          />
        </sm-field>
      </div>
      @if (periodError(); as message) {
        <p class="sm-error -mt-2" role="alert">{{ message }}</p>
      }
      <div class="grid gap-4 sm:grid-cols-2">
        <sm-field
          [label]="text.startTime"
          [optional]="isClosure()"
          [hint]="isClosure() ? text.timesHint : undefined"
          [patternMessage]="patterns.localTime"
        >
          <input smFieldControl class="sm-input" type="time" formControlName="startTime" />
        </sm-field>
        <sm-field
          [label]="text.endTime"
          [optional]="isClosure()"
          [patternMessage]="patterns.localTime"
        >
          <input smFieldControl class="sm-input" type="time" formControlName="endTime" />
        </sm-field>
      </div>
      @if (timesError(); as message) {
        <p class="sm-error -mt-2" role="alert" data-testid="times-error">{{ message }}</p>
      }
      <sm-field [label]="text.reason" [optional]="true">
        <input smFieldControl class="sm-input" formControlName="reason" />
      </sm-field>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" smButton="secondary" [disabled]="saving()" (click)="ref.close()">
          {{ cancelText }}
        </button>
        <button type="submit" smButton="primary" [loading]="saving()">{{ text.save }}</button>
      </div>
    </form>
  `,
})
export class ExceptionFormDialogComponent {
  private readonly data = inject<ExceptionFormDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<ScheduleExceptionCreated>>(DialogRef);
  private readonly api = inject(ScheduleApi);

  protected readonly text = PROVIDER_MESSAGES.exceptionForm;
  protected readonly cancelText = COMMON_MESSAGES.actions.cancel;
  protected readonly patterns = PATTERN_MESSAGES;
  protected readonly titleId = EXCEPTION_FORM_TITLE_ID;
  protected readonly types = SCHEDULE_EXCEPTION_TYPE_VALUES;
  protected readonly typeLabels = SCHEDULE_EXCEPTION_TYPE_LABELS;
  protected readonly today = todayInZone(this.data.timeZoneId);

  protected readonly form = new FormGroup(
    {
      type: new FormControl<ScheduleExceptionType>('Closure', { nonNullable: true }),
      startDate: new FormControl(this.today, {
        nonNullable: true,
        validators: [Validators.required, notBefore(this.today)],
      }),
      endDate: new FormControl(this.today, {
        nonNullable: true,
        validators: [Validators.required],
      }),
      startTime: new FormControl('', {
        nonNullable: true,
        validators: [Validators.pattern(LOCAL_TIME)],
      }),
      endTime: new FormControl('', {
        nonNullable: true,
        validators: [Validators.pattern(LOCAL_TIME)],
      }),
      reason: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    },
    {
      validators: [
        exceptionPeriod('startDate', 'endDate', EXCEPTION_MAX_PERIOD_DAYS),
        exceptionTimes,
      ],
    },
  );

  private readonly events = toSignal(this.form.events);
  protected readonly saving = signal(false);
  protected readonly summary = signal<string[]>([]);

  protected isClosure(): boolean {
    this.events();
    return this.form.controls.type.value === 'Closure';
  }

  protected typeHint(): string {
    this.events();
    return this.text.typeHint[this.form.controls.type.value];
  }

  protected periodError(): string | null {
    this.events();
    const errors = this.form.errors;
    if (!errors || !this.form.controls.endDate.touched) {
      return null;
    }
    if (errors['periodOrder']) {
      return this.text.periodOrder;
    }
    if (errors['periodTooLong']) {
      return this.text.periodTooLong(EXCEPTION_MAX_PERIOD_DAYS);
    }
    return null;
  }

  protected timesError(): string | null {
    this.events();
    const errors = this.form.errors;
    const touched = this.form.controls.startTime.touched || this.form.controls.endTime.touched;
    if (!errors || !touched) {
      return null;
    }
    if (errors['timesRequired']) {
      return this.text.timesRequired;
    }
    if (errors['timesPair']) {
      return this.text.timesPair;
    }
    if (errors['timeRange']) {
      return this.text.timeRange;
    }
    return null;
  }

  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    this.summary.set([]);
    this.saving.set(true);
    this.api
      .createException(this.toRequest())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (created) => this.ref.close(created),
        error: (error: unknown) => this.summary.set(handleFormError(this.form, error).summary),
      });
  }

  private toRequest(): ScheduleExceptionRequest {
    const v = this.form.getRawValue();
    return {
      type: v.type,
      startDate: v.startDate,
      endDate: v.endDate,
      startTime: v.startTime || null,
      endTime: v.endTime || null,
      reason: v.reason.trim() || null,
    };
  }
}
