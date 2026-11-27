import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SERVER_ERROR_KEY } from '../../../core/errors/form-errors';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { WeeklySchedule, WeeklyScheduleDay } from '../../../core/models/api-models';
import { DAY_OF_WEEK_VALUES, type DayOfWeek } from '../../../core/models/enums';
import { DAY_OF_WEEK_LABELS } from '../../../core/models/labels';
import { PATTERN_MESSAGES, validationMessage } from '../../../shared/forms/validation-messages';
import { nonOverlappingIntervals, SmValidators, timeRange } from '../../../shared/forms/validators';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { FormErrorSummaryComponent } from '../../../shared/ui/form-error-summary.component';

export const MAX_INTERVALS_PER_DAY = 10;

type IntervalForm = FormGroup<{ start: FormControl<string>; end: FormControl<string> }>;
type DayForm = FormGroup<{ dayOfWeek: FormControl<DayOfWeek>; intervals: FormArray<IntervalForm> }>;

function intervalForm(start = '', end = ''): IntervalForm {
  return new FormGroup(
    {
      start: new FormControl(start, { nonNullable: true, validators: SmValidators.localTime }),
      end: new FormControl(end, { nonNullable: true, validators: SmValidators.localTime }),
    },
    { validators: timeRange('start', 'end') },
  );
}

/** Caminho do `400` (`days[0].intervals[1].end`) → posição no corpo enviado. */
const SERVER_PATH = /^days\[(\d+)\]\.intervals\[(\d+)\]/;

let nextEditorId = 0;

/**
 * Editor do expediente semanal (FR-041): Domingo → Sábado, 1–10 faixas por dia. Faixa com
 * início ≥ fim (ou atravessando a meia-noite) e faixas sobrepostas marcam o erro **na própria
 * faixa**, e nada é enviado. Dia sem faixas = fechado, omitido do corpo; o `PUT` leva só `days`.
 */
@Component({
  selector: 'sm-schedule-editor',
  standalone: true,
  imports: [ReactiveFormsModule, ButtonDirective, FormErrorSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="submit()">
      <sm-form-error-summary [messages]="summary()" title="" />
      <div formArrayName="days" class="flex flex-col gap-3">
        @for (day of days.controls; track day.controls.dayOfWeek.value; let d = $index) {
          <fieldset
            class="sm-card"
            [formGroupName]="d"
            [attr.data-testid]="'day-' + day.controls.dayOfWeek.value"
          >
            <legend class="px-1 font-semibold">{{ dayLabel(day) }}</legend>
            @if (day.controls.intervals.length === 0) {
              <p class="text-sm text-gray-700">{{ text.closed }}</p>
            }
            <div formArrayName="intervals" class="flex flex-col gap-2">
              @for (interval of day.controls.intervals.controls; track $index; let i = $index) {
                <fieldset [formGroupName]="i" class="flex flex-col gap-1">
                  <legend class="sr-only">{{ text.intervalLabel(dayLabel(day), i + 1) }}</legend>
                  <div class="flex flex-wrap items-end gap-2">
                    <div>
                      <label class="sm-label" [attr.for]="fieldId(d, i, 'start')">{{
                        text.start
                      }}</label>
                      <input
                        class="sm-input w-auto"
                        type="time"
                        [id]="fieldId(d, i, 'start')"
                        formControlName="start"
                        [attr.aria-invalid]="intervalError(d, i) ? 'true' : null"
                        [attr.aria-describedby]="intervalError(d, i) ? errorId(d, i) : null"
                      />
                    </div>
                    <div>
                      <label class="sm-label" [attr.for]="fieldId(d, i, 'end')">{{
                        text.end
                      }}</label>
                      <input
                        class="sm-input w-auto"
                        type="time"
                        [id]="fieldId(d, i, 'end')"
                        formControlName="end"
                        [attr.aria-invalid]="intervalError(d, i) ? 'true' : null"
                        [attr.aria-describedby]="intervalError(d, i) ? errorId(d, i) : null"
                      />
                    </div>
                    <button
                      type="button"
                      smButton="ghost"
                      [attr.aria-label]="
                        text.removeInterval + ' — ' + text.intervalLabel(dayLabel(day), i + 1)
                      "
                      (click)="removeInterval(d, i)"
                    >
                      {{ text.removeInterval }}
                    </button>
                  </div>
                  @if (intervalError(d, i); as message) {
                    <p class="sm-error" [id]="errorId(d, i)" data-testid="interval-error">
                      {{ message }}
                    </p>
                  }
                </fieldset>
              }
            </div>
            <div class="mt-2">
              <button
                type="button"
                smButton="secondary"
                [disabled]="day.controls.intervals.length >= maxIntervals"
                [attr.aria-label]="text.addInterval + ' — ' + dayLabel(day)"
                (click)="addInterval(d)"
              >
                {{ text.addInterval }}
              </button>
              @if (day.controls.intervals.length >= maxIntervals) {
                <span class="sm-hint ml-2">{{ text.maxIntervals(maxIntervals) }}</span>
              }
            </div>
          </fieldset>
        }
      </div>
      <div>
        <button type="submit" smButton="primary" [loading]="saving()">{{ text.save }}</button>
      </div>
    </form>
  `,
})
export class ScheduleEditorComponent {
  readonly schedule = input.required<WeeklySchedule>();
  readonly saving = input(false);
  readonly save = output<Pick<WeeklySchedule, 'days'>>();

  protected readonly text = PROVIDER_MESSAGES.schedule;
  protected readonly maxIntervals = MAX_INTERVALS_PER_DAY;
  private readonly idPrefix = `sm-schedule-${nextEditorId++}`;

  protected readonly form = new FormGroup({
    days: new FormArray<DayForm>(
      DAY_OF_WEEK_VALUES.map(
        (dayOfWeek) =>
          new FormGroup({
            dayOfWeek: new FormControl(dayOfWeek, { nonNullable: true }),
            intervals: new FormArray<IntervalForm>([], {
              validators: nonOverlappingIntervals('start', 'end'),
            }),
          }),
      ),
    ),
  });
  protected readonly days = this.form.controls.days;

  /** Recalcula os erros por faixa a cada evento do formulário (zoneless). */
  private readonly formEvents = toSignal(this.form.events);
  protected readonly summary = signal<string[]>([]);
  private readonly serverErrors = signal(0);
  /** Ordem dos dias no último corpo enviado, para mapear os erros do servidor. */
  private sentDays: number[] = [];

  constructor() {
    effect(() => {
      const schedule = this.schedule();
      untracked(() => this.load(schedule));
    });
  }

  private load(schedule: WeeklySchedule): void {
    this.days.controls.forEach((day) => {
      const saved = schedule.days.find((d) => d.dayOfWeek === day.controls.dayOfWeek.value);
      day.controls.intervals.clear({ emitEvent: false });
      saved?.intervals.forEach((i) =>
        day.controls.intervals.push(intervalForm(i.start, i.end), { emitEvent: false }),
      );
    });
    this.form.updateValueAndValidity();
    this.form.markAsPristine();
    this.form.markAsUntouched();
  }

  protected dayLabel(day: DayForm): string {
    return DAY_OF_WEEK_LABELS[day.controls.dayOfWeek.value];
  }

  protected fieldId(d: number, i: number, part: 'start' | 'end'): string {
    return `${this.idPrefix}-${d}-${i}-${part}`;
  }

  protected errorId(d: number, i: number): string {
    return `${this.idPrefix}-${d}-${i}-error`;
  }

  /** Mensagem da faixa: servidor, horário inválido, início ≥ fim ou sobreposição. */
  protected intervalError(d: number, i: number): string | null {
    this.formEvents();
    this.serverErrors();
    const day = this.days.at(d);
    const interval = day.controls.intervals.at(i);
    if (!interval.touched) {
      return null;
    }
    for (const control of [interval.controls.start, interval.controls.end]) {
      if (control.invalid) {
        return validationMessage(control.errors, PATTERN_MESSAGES.localTime);
      }
    }
    if (interval.errors) {
      return validationMessage(interval.errors);
    }
    const overlap: unknown = day.controls.intervals.errors?.['overlap'];
    if (isOverlap(overlap) && overlap.indexes.includes(i)) {
      return validationMessage({ overlap });
    }
    return null;
  }

  protected addInterval(d: number): void {
    const intervals = this.days.at(d).controls.intervals;
    if (intervals.length < MAX_INTERVALS_PER_DAY) {
      intervals.push(intervalForm());
    }
  }

  protected removeInterval(d: number, i: number): void {
    this.days.at(d).controls.intervals.removeAt(i);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.summary.set([this.text.invalid]);
      return;
    }
    this.summary.set([]);
    const days: WeeklyScheduleDay[] = [];
    this.sentDays = [];
    this.days.controls.forEach((day, index) => {
      const intervals = day.controls.intervals.getRawValue();
      if (intervals.length > 0) {
        days.push({ dayOfWeek: day.controls.dayOfWeek.value, intervals });
        this.sentDays.push(index);
      }
    });
    this.save.emit({ days });
  }

  /**
   * Erros do servidor nas faixas (`400` com `days[i].intervals[j]…`). Devolve as mensagens sem
   * faixa correspondente, para o resumo.
   */
  showServerErrors(errors: Readonly<Record<string, readonly string[]>>): string[] {
    const unmatched: string[] = [];
    for (const [path, messages] of Object.entries(errors)) {
      const match = SERVER_PATH.exec(path);
      const dayIndex = match ? this.sentDays[Number(match[1])] : undefined;
      const interval =
        match && dayIndex !== undefined
          ? this.days.at(dayIndex).controls.intervals.at(Number(match[2]))
          : undefined;
      const message = messages[0];
      if (interval && message) {
        interval.setErrors({ ...(interval.errors ?? {}), [SERVER_ERROR_KEY]: message });
        interval.markAsTouched();
      } else {
        unmatched.push(...messages);
      }
    }
    this.serverErrors.update((n) => n + 1);
    return unmatched;
  }

  /** Mensagem geral (ex.: `422 schedule.invalid_working_hours` sem faixa indicada). */
  showSummary(messages: string[]): void {
    this.summary.set(messages);
  }
}

function isOverlap(value: unknown): value is { indexes: number[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { indexes?: unknown }).indexes)
  );
}
