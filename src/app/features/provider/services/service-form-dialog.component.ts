import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ServicesApi } from '../../../core/api/services.api';
import { handleFormError } from '../../../core/errors/form-errors';
import { COMMON_MESSAGES } from '../../../core/i18n/common.messages';
import { PROVIDER_MESSAGES } from '../../../core/i18n/provider.messages';
import type { Service, ServiceRequest } from '../../../core/models/api-models';
import { brlAmount, formatBrlInput, parseBrl } from '../../../shared/forms/brl';
import { multipleOf } from '../../../shared/forms/validators';
import { ButtonDirective } from '../../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../../shared/ui/form-error-summary.component';

export interface ServiceFormDialogData {
  /** Ausente = novo serviço. */
  readonly service?: Service;
}

export const SERVICE_FORM_TITLE_ID = 'sm-service-form-title';

const DURATION_MIN = 5;
const DURATION_MAX = 720;
const DURATION_STEP = 5;

/**
 * Criar/editar serviço (FR-040, US4 #9): nome 2–100 (`409 service.name_taken` no campo),
 * descrição ≤ 1000, duração 5–720 em múltiplos de 5 e preço BRL 0,00–99.999,99.
 */
@Component({
  selector: 'sm-service-form-dialog',
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
    <h2 [id]="titleId" class="mb-3">{{ editing ? text.editTitle : text.createTitle }}</h2>
    <form class="flex flex-col gap-4" [formGroup]="form" novalidate (ngSubmit)="save()">
      <sm-form-error-summary [messages]="summary()" />
      @if (editing) {
        <p class="sm-hint" data-testid="snapshot-notice">{{ text.snapshotNotice }}</p>
      }
      <sm-field [label]="text.name">
        <input smFieldControl class="sm-input" formControlName="name" />
      </sm-field>
      <sm-field [label]="text.description" [optional]="true">
        <textarea
          smFieldControl
          class="sm-textarea"
          rows="3"
          formControlName="description"
        ></textarea>
      </sm-field>
      <div class="grid gap-4 sm:grid-cols-2">
        <sm-field [label]="text.duration" [hint]="text.durationHint">
          <input
            smFieldControl
            class="sm-input"
            type="number"
            inputmode="numeric"
            [min]="durationMin"
            [max]="durationMax"
            [step]="durationStep"
            formControlName="durationMinutes"
          />
        </sm-field>
        <sm-field [label]="text.price" [hint]="text.priceHint">
          <input smFieldControl class="sm-input" inputmode="decimal" formControlName="price" />
        </sm-field>
      </div>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" smButton="secondary" [disabled]="saving()" (click)="ref.close()">
          {{ cancelText }}
        </button>
        <button type="submit" smButton="primary" [loading]="saving()">{{ text.save }}</button>
      </div>
    </form>
  `,
})
export class ServiceFormDialogComponent {
  private readonly data = inject<ServiceFormDialogData>(DIALOG_DATA);
  protected readonly ref = inject<DialogRef<Service>>(DialogRef);
  private readonly api = inject(ServicesApi);

  protected readonly text = PROVIDER_MESSAGES.serviceForm;
  protected readonly cancelText = COMMON_MESSAGES.actions.cancel;
  protected readonly titleId = SERVICE_FORM_TITLE_ID;
  protected readonly editing = this.data.service !== undefined;
  protected readonly durationMin = DURATION_MIN;
  protected readonly durationMax = DURATION_MAX;
  protected readonly durationStep = DURATION_STEP;

  protected readonly form = new FormGroup({
    name: new FormControl(this.data.service?.name ?? '', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
    description: new FormControl(this.data.service?.description ?? '', {
      nonNullable: true,
      validators: [Validators.maxLength(1000)],
    }),
    durationMinutes: new FormControl<number | null>(this.data.service?.durationMinutes ?? 30, {
      validators: [
        Validators.required,
        Validators.min(DURATION_MIN),
        Validators.max(DURATION_MAX),
        multipleOf(DURATION_STEP),
      ],
    }),
    price: new FormControl(this.data.service ? formatBrlInput(this.data.service.price) : '', {
      nonNullable: true,
      validators: [Validators.required, brlAmount],
    }),
  });

  protected readonly saving = signal(false);
  protected readonly summary = signal<string[]>([]);

  protected save(): void {
    if (this.saving()) {
      return;
    }
    this.form.markAllAsTouched();
    const body = this.toRequest();
    if (this.form.invalid || !body) {
      return;
    }
    this.summary.set([]);
    this.saving.set(true);
    const service = this.data.service;
    const request = service ? this.api.update(service.id, body) : this.api.create(body);
    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: (saved) => this.ref.close(saved),
      error: (error: unknown) => this.summary.set(handleFormError(this.form, error).summary),
    });
  }

  private toRequest(): ServiceRequest | null {
    const v = this.form.getRawValue();
    const price = parseBrl(v.price);
    if (price === null || v.durationMinutes === null) {
      return null;
    }
    return {
      name: v.name.trim(),
      description: v.description.trim() || null,
      durationMinutes: v.durationMinutes,
      price,
    };
  }
}
