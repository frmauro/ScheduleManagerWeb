/** Constantes da aplicação (Art. III.2: sem valores mágicos). */

export const STORAGE_KEYS = {
  session: 'sm.session',
  bookingDraft: 'sm.booking-draft',
} as const;

/** Aviso de sessão N minutos antes de `expiresAt` (FR-017a). */
export const SESSION_WARNING_MINUTES = 5;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
/** Visões dia/semana da agenda paginam até completar (R16). */
export const CALENDAR_PAGE_SIZE = 100;

/** Período máximo dos filtros `from`/`to` das listas de agendamentos. */
export const MAX_PERIOD_DAYS = 366;
/** Período máximo de uma exceção de agenda (`endDate − startDate + 1`). */
export const EXCEPTION_MAX_PERIOD_DAYS = 366;
/** Calendário de reserva: de hoje até +N dias (máximo possível do horizonte). */
export const BOOKING_MAX_DAYS_AHEAD = 365;

export const NOTES_MAX = 500;
export const CANCEL_REASON_MIN = 3;
export const CANCEL_REASON_MAX = 500;

export const DEFAULT_TIME_ZONE = 'America/Sao_Paulo';
export const RESCHEDULE_DEFAULT_REASON = 'Reagendamento solicitado pelo cliente';

export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;
