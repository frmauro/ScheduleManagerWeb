import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, map, type Observable } from 'rxjs';
import { CANCEL_REASON_MAX, CANCEL_REASON_MIN } from '../../core/config/app.constants';
import { ApiError, isApiError } from '../../core/errors/api-error';
import { resolveErrorMessage } from '../../core/errors/error-messages';
import { DialogService } from '../../core/feedback/dialog.service';
import { CANCEL_MESSAGES } from '../../core/i18n/provider.messages';
import type { AdminCancelRequest, CancelRequest } from '../../core/models/api-models';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../shared/ui/form-error-summary.component';

export type OnBehalfOf = AdminCancelRequest['onBehalfOf'];

export interface CancelDialogData<T> {
  /** Admin: obriga escolher em nome de quem cancela (FR-053). */
  readonly requireOnBehalfOf?: boolean;
  /** Cliente: aviso fixo sobre a antecedência mínima (FR-034). */
  readonly showCustomerNotice?: boolean;
  /** Executa o cancelamento; o diálogo fecha com o resultado ou mostra o erro. */
  readonly submit: (body: CancelRequest | AdminCancelRequest) => Observable<T>;
}

/** Resultado do diálogo: o valor devolvido por `submit`, ou nada se o usuário desistiu. */
export interface CancelDialogResult<T> {
  readonly value: T;
}

const TITLE_ID = 'sm-cancel-dialog-title';

/**
 * Cancelamento com motivo obrigatório (3–500, contador) e envio desabilitado durante a
 * requisição (FR-005). Reutilizado por prestador, cliente e Admin.
 */
@Component({
  selector: 'sm-cancel-dialog',
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
    <form class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="send()">
      <sm-form-error-summary [messages]="errors()" title="" />
      @if (data.showCustomerNotice) {
        <p class="sm-hint" data-testid="cancel-customer-notice">{{ text.customerNotice }}</p>
      }
      @if (data.requireOnBehalfOf) {
        <fieldset>
          <legend class="sm-label">{{ text.onBehalfOf }}</legend>
          <div class="flex flex-col gap-1">
            <label class="inline-flex items-center gap-2">
              <input type="radio" formControlName="onBehalfOf" value="Customer" />
              {{ text.onBehalfOfCustomer }}
            </label>
            <label class="inline-flex items-center gap-2">
              <input type="radio" formControlName="onBehalfOf" value="Provider" />
              {{ text.onBehalfOfProvider }}
            </label>
          </div>
          @if (onBehalfOfMissing()) {
            <p class="sm-error" role="alert">{{ text.chooseOnBehalfOf }}</p>
          }
        </fieldset>
      }
      <sm-field [label]="text.reason" [hint]="text.reasonHint(min, max)">
        <textarea smFieldControl class="sm-textarea" rows="3" formControlName="reason"></textarea>
      </sm-field>
      <p class="sm-hint -mt-3" aria-live="polite">{{ text.counter(length(), max) }}</p>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" smButton="secondary" [disabled]="sending()" (click)="close()">
          {{ text.keep }}
        </button>
        <button type="submit" smButton="danger" [loading]="sending()">
          {{ sending() ? text.sending : text.confirm }}
        </button>
      </div>
    </form>
  `,
})
export class CancelDialogComponent implements OnInit {
  protected readonly data = inject<CancelDialogData<unknown>>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<CancelDialogResult<unknown>>>(DialogRef);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly text = CANCEL_MESSAGES;
  protected readonly titleId = TITLE_ID;
  protected readonly min = CANCEL_REASON_MIN;
  protected readonly max = CANCEL_REASON_MAX;

  protected readonly form = new FormGroup({
    reason: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(CANCEL_REASON_MIN),
        Validators.maxLength(CANCEL_REASON_MAX),
      ],
    }),
    onBehalfOf: new FormControl<OnBehalfOf | null>(null),
  });

  protected readonly sending = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly onBehalfOfMissing = signal(false);
  private readonly reason = toSignal(this.form.controls.reason.valueChanges, { initialValue: '' });

  ngOnInit(): void {
    const sub = this.form.controls.onBehalfOf.valueChanges.subscribe(() =>
      this.onBehalfOfMissing.set(false),
    );
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  protected length(): number {
    return this.reason().length;
  }

  protected send(): void {
    if (this.sending()) {
      return;
    }
    this.form.controls.reason.setValue(this.form.controls.reason.value.trim());
    this.form.markAllAsTouched();
    const onBehalfOf = this.form.controls.onBehalfOf.value;
    const missing = this.data.requireOnBehalfOf === true && onBehalfOf === null;
    this.onBehalfOfMissing.set(missing);
    if (this.form.invalid || missing) {
      return;
    }
    const reason = this.form.controls.reason.value;
    const body: CancelRequest | AdminCancelRequest =
      this.data.requireOnBehalfOf && onBehalfOf ? { reason, onBehalfOf } : { reason };
    this.errors.set([]);
    this.sending.set(true);
    this.data
      .submit(body)
      .pipe(finalize(() => this.sending.set(false)))
      .subscribe({
        next: (value) => this.ref.close({ value }),
        error: (error: unknown) => {
          const apiError = isApiError(error) ? error : new ApiError({ kind: 'unknown', status: 0 });
          this.errors.set([resolveErrorMessage(apiError)]);
        },
      });
  }

  protected close(): void {
    this.ref.close();
  }
}

/** Abre o diálogo; emite o resultado de `submit` ao concluir, ou `undefined` se desistir. */
export function openCancelDialog<T>(
  dialogs: DialogService,
  data: CancelDialogData<T>,
): Observable<T | undefined> {
  const ref = dialogs.open<CancelDialogResult<unknown>, CancelDialogData<T>, CancelDialogComponent>(
    CancelDialogComponent,
    { data, ariaLabelledBy: TITLE_ID },
  );
  return ref.closed.pipe(map((result) => result?.value as T | undefined));
}
