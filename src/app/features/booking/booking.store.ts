import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { AppointmentsApi, type CreateAppointmentResult } from '../../core/api/appointments.api';
import { STORAGE_KEYS } from '../../core/config/app.constants';
import { ApiError, isApiError } from '../../core/errors/api-error';
import { resolveErrorMessage } from '../../core/errors/error-messages';
import type { Instant, LocalDate, Uuid } from '../../core/models/api-models';

/** O que o cliente escolheu; o `startAt` é o do slot, opaco (FR-026). */
export interface BookingSelection {
  readonly providerId: Uuid;
  readonly serviceId: Uuid;
  readonly date: LocalDate;
  readonly startAt: Instant;
}

/**
 * - `choosing`: escolhendo o horário (também depois de uma recusa que exige outro horário);
 * - `reviewing`: resumo aberto; `submitting`: envio em andamento;
 * - `success`: criado (ou já criado com a mesma chave); `error`: recusa que mantém o resumo.
 */
export type BookingPhase = 'choosing' | 'reviewing' | 'submitting' | 'success' | 'error';

/** Recusas que voltam à escolha de horário (FR-030, contracts/error-catalog.md). */
const BACK_TO_SLOTS_CODES = [
  'appointment.slot_unavailable',
  'availability.outside_working_hours',
  'availability.closed',
  'availability.misaligned_start',
  'availability.too_soon',
  'availability.beyond_horizon',
  'availability.date_in_past',
  'service.inactive',
  'provider.inactive',
] as const;

/** Dessas, as que pedem a recarga dos horários da data. */
const RELOAD_SLOTS_CODES = [
  'appointment.slot_unavailable',
  'availability.outside_working_hours',
  'availability.misaligned_start',
  'availability.too_soon',
] as const;

const KEY_REUSED = 'idempotency.key_reused';

interface BookingDraft {
  readonly providerId: Uuid;
  readonly serviceId: Uuid;
  readonly notes: string;
}

function isBookingDraft(value: unknown): value is BookingDraft {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const draft = value as Record<string, unknown>;
  return (
    typeof draft['providerId'] === 'string' &&
    typeof draft['serviceId'] === 'string' &&
    typeof draft['notes'] === 'string'
  );
}

function newKey(): Uuid {
  return globalThis.crypto.randomUUID();
}

/**
 * Tentativa de reserva (`BookingAttempt`, data-model §4) no escopo da rota de reserva.
 * Uma `Idempotency-Key` por tentativa: nasce ao abrir o resumo, é reutilizada em todo reenvio
 * (duplo clique, falha de rede) e só muda quando o pedido muda (FR-027).
 */
@Injectable()
export class BookingStore {
  private readonly api = inject(AppointmentsApi);
  private request: Subscription | null = null;
  /** Pedido a que a chave atual pertence. */
  private keyFingerprint: string | null = null;

  private readonly phaseState = signal<BookingPhase>('choosing');
  private readonly selectionState = signal<BookingSelection | null>(null);
  private readonly notesState = signal('');
  private readonly keyState = signal<Uuid | null>(null);
  private readonly resultState = signal<CreateAppointmentResult | null>(null);
  private readonly errorState = signal<ApiError | null>(null);
  private readonly reloadsState = signal(0);

  readonly phase = this.phaseState.asReadonly();
  readonly selection = this.selectionState.asReadonly();
  readonly notes = this.notesState.asReadonly();
  readonly idempotencyKey = this.keyState.asReadonly();
  readonly result = this.resultState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Incrementa quando os horários da data devem ser consultados de novo. */
  readonly slotsReloads = this.reloadsState.asReadonly();
  readonly errorMessage = computed(() => {
    const error = this.errorState();
    return error ? resolveErrorMessage(error) : null;
  });
  readonly submitting = computed(() => this.phaseState() === 'submitting');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
  }

  /** Abre o resumo para um horário escolhido. */
  review(selection: BookingSelection): void {
    if (this.phaseState() === 'submitting' || this.phaseState() === 'success') {
      return;
    }
    const previous = this.selectionState();
    if (
      !previous ||
      previous.providerId !== selection.providerId ||
      previous.serviceId !== selection.serviceId
    ) {
      this.notesState.set(this.readDraft(selection)?.notes ?? '');
    }
    this.selectionState.set(selection);
    this.errorState.set(null);
    this.phaseState.set('reviewing');
    this.syncKey();
  }

  /** Volta à escolha de horário ("Trocar horário"). */
  choose(): void {
    if (this.phaseState() === 'submitting' || this.phaseState() === 'success') {
      return;
    }
    this.errorState.set(null);
    this.phaseState.set('choosing');
  }

  setNotes(notes: string): void {
    this.notesState.set(notes);
    const selection = this.selectionState();
    if (selection) {
      this.writeDraft({ providerId: selection.providerId, serviceId: selection.serviceId, notes });
    }
    this.syncKey();
  }

  submit(): void {
    const selection = this.selectionState();
    const phase = this.phaseState();
    if (!selection || (phase !== 'reviewing' && phase !== 'error')) {
      return;
    }
    const key = this.syncKey();
    this.errorState.set(null);
    this.phaseState.set('submitting');
    this.request = this.api
      .create(
        {
          providerId: selection.providerId,
          serviceId: selection.serviceId,
          startAt: selection.startAt,
          notes: this.notesState(),
        },
        key,
      )
      .subscribe({
        next: (result) => {
          this.resultState.set(result);
          this.phaseState.set('success');
          this.clearDraft();
        },
        error: (error: unknown) => this.fail(error),
      });
  }

  private fail(raw: unknown): void {
    const error = isApiError(raw) ? raw : new ApiError({ kind: 'unknown', status: 0 });
    this.errorState.set(error);
    if (error.hasCode(...BACK_TO_SLOTS_CODES)) {
      if (error.hasCode(...RELOAD_SLOTS_CODES)) {
        this.reloadsState.update((n) => n + 1);
      }
      this.phaseState.set('choosing');
      return;
    }
    if (error.hasCode(KEY_REUSED)) {
      this.regenerateKey();
    }
    // Demais recusas e falhas de rede: o resumo continua aberto e o reenvio usa a mesma chave.
    this.phaseState.set('error');
  }

  /** Mantém a chave enquanto o pedido for o mesmo; gera outra quando ele muda. */
  private syncKey(): Uuid {
    const fingerprint = this.fingerprint();
    const current = this.keyState();
    if (current && fingerprint === this.keyFingerprint) {
      return current;
    }
    return this.regenerateKey();
  }

  private regenerateKey(): Uuid {
    const key = newKey();
    this.keyState.set(key);
    this.keyFingerprint = this.fingerprint();
    return key;
  }

  private fingerprint(): string {
    const s = this.selectionState();
    return JSON.stringify([s?.providerId, s?.serviceId, s?.startAt, this.notesState()]);
  }

  private readDraft(selection: BookingSelection): BookingDraft | null {
    try {
      const parsed: unknown = JSON.parse(
        sessionStorage.getItem(STORAGE_KEYS.bookingDraft) ?? 'null',
      );
      return isBookingDraft(parsed) &&
        parsed.providerId === selection.providerId &&
        parsed.serviceId === selection.serviceId
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  private writeDraft(draft: BookingDraft): void {
    try {
      sessionStorage.setItem(STORAGE_KEYS.bookingDraft, JSON.stringify(draft));
    } catch {
      // Sem storage (modo privado restrito): o rascunho só se perde no redirecionamento.
    }
  }

  private clearDraft(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEYS.bookingDraft);
    } catch {
      // idem
    }
  }
}
