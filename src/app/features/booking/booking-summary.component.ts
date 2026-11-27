import { CurrencyPipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
  type OnInit,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { NOTES_MAX } from '../../core/config/app.constants';
import { formatDuration } from '../../core/domain/booking-policy-format';
import { BOOKING_MESSAGES } from '../../core/i18n/booking.messages';
import type { Instant, ProviderPublicProfile, Service } from '../../core/models/api-models';
import { InZonePipe } from '../../shared/time/in-zone.pipe';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../shared/ui/field.component';
import { ZoneHintComponent } from '../../shared/ui/zone-hint.component';

/**
 * Resumo antes de confirmar (FR-025): prestador, serviço, duração, preço, data/hora no fuso do
 * prestador e observações (≤ 500). Avisos e erros da página entram pelo `ng-content`.
 */
@Component({
  selector: 'sm-booking-summary',
  standalone: true,
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    InZonePipe,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    ZoneHintComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="sm-card" aria-labelledby="sm-booking-summary-title">
      <h2 #heading id="sm-booking-summary-title" class="text-lg" tabindex="-1">
        {{ text.title }}
      </h2>
      <dl class="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-[max-content_1fr]">
        <dt class="font-medium">{{ text.provider }}</dt>
        <dd data-testid="summary-provider">{{ provider().displayName }}</dd>
        <dt class="font-medium">{{ text.service }}</dt>
        <dd data-testid="summary-service">{{ service().name }}</dd>
        <dt class="font-medium">{{ text.duration }}</dt>
        <dd data-testid="summary-duration">{{ duration() }}</dd>
        <dt class="font-medium">{{ text.price }}</dt>
        <dd data-testid="summary-price">{{ service().price | currency }}</dd>
        <dt class="font-medium">{{ text.when }}</dt>
        <dd data-testid="summary-when">
          {{ startAt() | inZone: provider().timeZoneId }}
          <sm-zone-hint class="block" [timeZone]="provider().timeZoneId" [at]="startAt()" />
        </dd>
      </dl>

      <form class="mt-4 flex flex-col gap-3" novalidate (submit)="onConfirm($event)">
        <sm-field [label]="text.notesLabel" [hint]="text.notesHint" [optional]="true">
          <textarea smFieldControl class="sm-input" rows="3" [formControl]="notes"></textarea>
        </sm-field>
        <p
          class="sm-hint -mt-2"
          [class.text-tone-danger-fg]="tooLong()"
          aria-live="polite"
          data-testid="notes-counter"
        >
          {{ text.notesCounter(length(), max) }}
        </p>

        <ng-content />

        <div class="flex flex-wrap gap-2">
          <button
            type="submit"
            smButton="primary"
            [loading]="submitting()"
            [disabled]="confirmDisabled()"
          >
            {{ submitting() ? text.submitting : text.confirm }}
          </button>
          <button
            type="button"
            smButton="secondary"
            [disabled]="submitting()"
            (click)="changeSlot.emit()"
          >
            {{ text.changeSlot }}
          </button>
        </div>
      </form>
    </section>
  `,
})
export class BookingSummaryComponent implements OnInit {
  readonly provider = input.required<ProviderPublicProfile>();
  readonly service = input.required<Service>();
  /** `startAt` do slot, exibido no fuso do prestador e nunca reconstruído (FR-026). */
  readonly startAt = input.required<Instant>();
  readonly initialNotes = input('');
  readonly submitting = input(false);
  /** Ex.: sessão de prestador/Admin, que não pode reservar. */
  readonly confirmDisabled = input(false);

  readonly notesChange = output<string>();
  readonly confirm = output<void>();
  readonly changeSlot = output<void>();

  protected readonly text = BOOKING_MESSAGES.summary;
  protected readonly max = NOTES_MAX;
  protected readonly notes = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(NOTES_MAX)],
  });

  private readonly value = toSignal(this.notes.valueChanges, { initialValue: '' });
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('heading');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // O resumo substitui a lista de horários: o foco vai para o título (FR-011).
    afterNextRender(() => this.heading().nativeElement.focus());
  }

  ngOnInit(): void {
    this.notes.setValue(this.initialNotes());
    const sub = this.notes.valueChanges.subscribe((v) => this.notesChange.emit(v));
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  protected length(): number {
    return this.value().length;
  }

  protected tooLong(): boolean {
    return this.length() > NOTES_MAX;
  }

  protected duration(): string {
    return formatDuration(this.service().durationMinutes);
  }

  protected onConfirm(event: Event): void {
    event.preventDefault();
    this.notes.markAsTouched();
    if (this.notes.invalid || this.submitting() || this.confirmDisabled()) {
      return;
    }
    this.confirm.emit();
  }
}
