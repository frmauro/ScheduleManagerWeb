/**
 * Catálogo de mensagens por `code` (contracts/error-catalog.md, FR-006, SC-007).
 * Resolução: catálogo → `detail` da API → mensagem genérica com `traceId`.
 */
import type { ApiError } from './api-error';

export const API_ERROR_CODES = [
  'validation.failed',
  'server.internal_error',
  'route.not_found',
  'auth.unauthenticated',
  'auth.invalid_credentials',
  'auth.forbidden',
  'user.email_taken',
  'user.not_found',
  'provider.not_found',
  'provider.inactive',
  'service.not_found',
  'service.inactive',
  'service.name_taken',
  'service.in_use',
  'schedule.invalid_working_hours',
  'schedule.invalid_exception',
  'schedule.exception_in_past',
  'schedule.special_hours_overlap',
  'schedule.exception_not_found',
  'availability.date_in_past',
  'availability.beyond_horizon',
  'availability.outside_working_hours',
  'availability.closed',
  'availability.misaligned_start',
  'availability.too_soon',
  'appointment.not_found',
  'appointment.slot_unavailable',
  'appointment.customer_overlap',
  'appointment.concurrency_conflict',
  'appointment.precondition_failed',
  'appointment.invalid_transition',
  'appointment.cancellation_window',
  'appointment.already_started',
  'appointment.not_started',
  'idempotency.key_reused',
  'admin.cannot_deactivate_self',
  'http.error',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Onde a mensagem aparece (contracts/error-catalog.md, "Apresentação"). */
export type ErrorPresentation = 'field' | 'inline' | 'toast' | 'page';

export interface ErrorMessageSpec {
  readonly message: string;
  readonly presentation: ErrorPresentation;
  /** Campo do formulário que recebe o erro, quando `presentation = 'field'`. */
  readonly field?: string;
}

const TRACE = '{traceId}';

export const ERROR_MESSAGES: Record<ApiErrorCode, ErrorMessageSpec> = {
  'validation.failed': { message: 'Alguns campos precisam de correção.', presentation: 'field' },
  'server.internal_error': {
    message: `Algo deu errado do nosso lado. Tente novamente. Código para suporte: ${TRACE}`,
    presentation: 'inline',
  },
  'route.not_found': { message: 'Página não encontrada.', presentation: 'page' },
  'auth.unauthenticated': { message: 'Sua sessão expirou. Entre novamente.', presentation: 'page' },
  'auth.invalid_credentials': { message: 'E-mail ou senha inválidos.', presentation: 'inline' },
  'auth.forbidden': { message: 'Você não tem permissão para esta ação.', presentation: 'toast' },
  'user.email_taken': {
    message: 'Este e-mail já está em uso.',
    presentation: 'field',
    field: 'email',
  },
  'user.not_found': { message: 'Usuário não encontrado.', presentation: 'inline' },
  'provider.not_found': { message: 'Prestador não encontrado.', presentation: 'page' },
  'provider.inactive': {
    message: 'Este prestador não está aceitando reservas no momento.',
    presentation: 'inline',
  },
  'service.not_found': {
    message: 'Serviço não encontrado ou indisponível.',
    presentation: 'inline',
  },
  'service.inactive': { message: 'Este serviço não está mais disponível.', presentation: 'inline' },
  'service.name_taken': {
    message: 'Você já tem um serviço com este nome.',
    presentation: 'field',
    field: 'name',
  },
  'service.in_use': {
    message: 'Este serviço já foi agendado e não pode ser excluído. Você pode desativá-lo.',
    presentation: 'inline',
  },
  'schedule.invalid_working_hours': {
    message:
      'Revise as faixas de horário: o início deve ser antes do fim e as faixas não podem se sobrepor.',
    presentation: 'field',
  },
  'schedule.invalid_exception': { message: 'Revise os dados da exceção.', presentation: 'field' },
  'schedule.exception_in_past': {
    message: 'Não é possível criar exceções em datas passadas.',
    presentation: 'field',
    field: 'startDate',
  },
  'schedule.special_hours_overlap': {
    message: 'Já existe um horário especial nessas datas.',
    presentation: 'inline',
  },
  'schedule.exception_not_found': {
    message: 'Esta exceção já foi removida.',
    presentation: 'toast',
  },
  'availability.date_in_past': {
    message: 'Escolha uma data a partir de hoje.',
    presentation: 'inline',
  },
  'availability.beyond_horizon': {
    message: 'O prestador ainda não abriu a agenda para esta data. Escolha uma data mais próxima.',
    presentation: 'inline',
  },
  'availability.outside_working_hours': {
    message: 'Este horário está fora do expediente do prestador.',
    presentation: 'inline',
  },
  'availability.closed': { message: 'O prestador não atende nesta data.', presentation: 'inline' },
  'availability.misaligned_start': {
    message: 'Este horário não é válido para a agenda do prestador.',
    presentation: 'inline',
  },
  'availability.too_soon': {
    message: 'Este horário exige mais antecedência para ser reservado.',
    presentation: 'inline',
  },
  'appointment.not_found': { message: 'Agendamento não encontrado.', presentation: 'inline' },
  'appointment.slot_unavailable': {
    message: 'Este horário acabou de ser ocupado. Escolha outro.',
    presentation: 'inline',
  },
  'appointment.customer_overlap': {
    message: 'Você já tem um agendamento nesse horário.',
    presentation: 'inline',
  },
  'appointment.concurrency_conflict': {
    message: 'Este agendamento foi alterado por outra pessoa. Veja o status atual.',
    presentation: 'inline',
  },
  'appointment.precondition_failed': {
    message: 'Este agendamento foi alterado por outra pessoa. Veja o status atual.',
    presentation: 'inline',
  },
  'appointment.invalid_transition': {
    message: 'Esta ação não é mais possível para o status atual do agendamento.',
    presentation: 'inline',
  },
  'appointment.cancellation_window': {
    message:
      'O prazo para cancelar pelo site terminou: este prestador exige antecedência mínima. Entre em contato com o prestador.',
    presentation: 'inline',
  },
  'appointment.already_started': {
    message: 'Este atendimento já começou e não pode mais ser cancelado.',
    presentation: 'inline',
  },
  'appointment.not_started': {
    message: 'O atendimento ainda não começou. Só é possível concluí-lo após o horário de início.',
    presentation: 'inline',
  },
  'idempotency.key_reused': {
    message: 'Não foi possível concluir a reserva. Revise os dados e confirme novamente.',
    presentation: 'inline',
  },
  'admin.cannot_deactivate_self': {
    message: 'Você não pode desativar a sua própria conta.',
    presentation: 'inline',
  },
  'http.error': {
    message: `Não foi possível concluir a solicitação. Código para suporte: ${TRACE}`,
    presentation: 'inline',
  },
};

/** Mensagens para erros sem `code` (contracts/error-catalog.md, última tabela). */
export const NETWORK_ERROR_MESSAGE =
  'Não foi possível conectar. Verifique sua internet e tente novamente.';
const UNKNOWN_ERROR_MESSAGE = `Algo deu errado do nosso lado. Código para suporte: ${TRACE}`;
const TRACE_UNAVAILABLE = 'indisponível';

export function isApiErrorCode(code: unknown): code is ApiErrorCode {
  return typeof code === 'string' && (API_ERROR_CODES as readonly string[]).includes(code);
}

function withTrace(template: string, traceId: string | undefined): string {
  return template.replaceAll(TRACE, traceId ?? TRACE_UNAVAILABLE);
}

/** Mensagem pt-BR a exibir para um erro da API. */
export function resolveErrorMessage(error: ApiError): string {
  if (error.kind === 'network') {
    return NETWORK_ERROR_MESSAGE;
  }
  if (error.kind === 'unknown') {
    return withTrace(UNKNOWN_ERROR_MESSAGE, error.traceId);
  }
  const code = error.code;
  if (isApiErrorCode(code)) {
    return withTrace(ERROR_MESSAGES[code].message, error.traceId);
  }
  const detail = error.problem?.detail;
  if (detail) {
    return detail;
  }
  return withTrace(UNKNOWN_ERROR_MESSAGE, error.traceId);
}
