import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, Subject, startWith, switchMap } from 'rxjs';
import { ProvidersApi } from '../../core/api/providers.api';
import { BOOKING_MAX_DAYS_AHEAD } from '../../core/config/app.constants';
import { CATALOG_MESSAGES } from '../../core/i18n/catalog.messages';
import type { AvailabilityResponse, LocalDate, TimeSlot, Uuid } from '../../core/models/api-models';
import { LOADING, toRemoteState, type RemoteState } from '../../shared/state/remote-state';
import { addDays, formatInZone, todayInZone } from '../../shared/time/zoned-time';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ErrorStateComponent } from '../../shared/ui/error-state.component';
import { SkeletonComponent } from '../../shared/ui/skeleton.component';
import { ZoneHintComponent } from '../../shared/ui/zone-hint.component';

/** Erros de data que não adianta repetir: o usuário precisa escolher outra data. */
const DATE_ERROR_CODES = ['availability.beyond_horizon', 'availability.date_in_past'] as const;

let nextPickerId = 0;

/**
 * Data + horários livres de um serviço, no fuso do prestador (FR-003, FR-004, FR-014).
 * A lista não reserva nada; o `startAt` escolhido sai **intacto** (FR-026).
 */
@Component({
  selector: 'sm-availability-picker',
  standalone: true,
  imports: [
    ButtonDirective,
    EmptyStateComponent,
    ErrorStateComponent,
    SkeletonComponent,
    ZoneHintComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label class="sm-label" [attr.for]="dateId">{{ text.dateLabel }}</label>
          <input
            class="sm-input w-auto"
            type="date"
            [id]="dateId"
            [min]="minDate()"
            [max]="maxDate()"
            [value]="selectedDate()"
            [attr.aria-describedby]="dateId + '-hint'"
            (change)="onDateInput($event)"
          />
          <p class="sm-hint" [id]="dateId + '-hint'">{{ text.dateHint }}</p>
        </div>
        <sm-zone-hint [timeZone]="timeZoneId()" [at]="slots()[0]?.startAt ?? null" />
      </div>

      @switch (state().status) {
        @case ('loading') {
          <sm-skeleton [rows]="2" />
        }
        @case ('empty') {
          <sm-empty-state [title]="text.emptyTitle" [description]="text.emptyDescription">
            @if (canGoNextDay()) {
              <button type="button" smButton="secondary" (click)="goNextDay()">
                {{ text.nextDay }}
              </button>
            }
          </sm-empty-state>
        }
        @case ('error') {
          @if (errorOf(state()); as error) {
            <sm-error-state
              [error]="error"
              [retryable]="!isDateError(error.code)"
              (retry)="reload()"
            />
          }
        }
        @case ('ready') {
          <ul class="grid grid-cols-3 gap-2 sm:grid-cols-5" [attr.aria-label]="text.slotsLabel">
            @for (slot of slots(); track slot.startAt) {
              <li>
                <button
                  type="button"
                  class="sm-btn sm-btn--secondary w-full"
                  [attr.aria-label]="slotAria(slot)"
                  (click)="slotSelected.emit(slot)"
                >
                  {{ timeOf(slot) }}
                </button>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
})
export class AvailabilityPickerComponent {
  readonly providerId = input.required<Uuid>();
  readonly serviceId = input.required<Uuid>();
  readonly timeZoneId = input.required<string>();
  /** Data no fuso do prestador; vazia = hoje. */
  readonly date = model<LocalDate | undefined>(undefined);
  readonly slotSelected = output<TimeSlot>();

  private readonly api = inject(ProvidersApi);
  private readonly reload$ = new Subject<void>();

  protected readonly text = CATALOG_MESSAGES.availability;
  protected readonly dateId = `sm-availability-date-${nextPickerId++}`;

  protected readonly minDate = computed(() => todayInZone(this.timeZoneId()));
  protected readonly maxDate = computed(() => addDays(this.minDate(), BOOKING_MAX_DAYS_AHEAD));
  protected readonly selectedDate = computed(() => this.date() ?? this.minDate());

  private readonly request = computed(() => ({
    providerId: this.providerId(),
    serviceId: this.serviceId(),
    date: this.selectedDate(),
  }));

  protected readonly state = toSignal(
    combineLatest([toObservable(this.request), this.reload$.pipe(startWith(undefined))]).pipe(
      switchMap(([req]) =>
        toRemoteState(
          this.api.availability(req.providerId, { serviceId: req.serviceId, date: req.date }),
          (r: AvailabilityResponse) => r.slots.length === 0,
        ),
      ),
    ),
    { initialValue: LOADING as RemoteState<AvailabilityResponse> },
  );

  protected readonly slots = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.value.slots : [];
  });

  protected readonly canGoNextDay = computed(() => this.selectedDate() < this.maxDate());

  protected onDateInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.date.set(value);
    }
  }

  protected goNextDay(): void {
    this.date.set(addDays(this.selectedDate(), 1));
  }

  reload(): void {
    this.reload$.next();
  }

  protected errorOf(state: RemoteState<AvailabilityResponse>) {
    return state.status === 'error' ? state.error : null;
  }

  protected isDateError(code: string | undefined): boolean {
    return code !== undefined && (DATE_ERROR_CODES as readonly string[]).includes(code);
  }

  protected timeOf(slot: TimeSlot): string {
    return formatInZone(slot.startAt, this.timeZoneId(), 'time');
  }

  protected slotAria(slot: TimeSlot): string {
    const tz = this.timeZoneId();
    return this.text.slotAriaLabel(
      formatInZone(slot.startAt, tz, 'time'),
      formatInZone(slot.startAt, tz, 'date'),
    );
  }
}
