import type { ValidationErrors } from '@angular/forms';
import { SERVER_ERROR_KEY } from '../../core/errors/form-errors';

type MessageFn = (detail: unknown) => string;

function numberField(detail: unknown, key: string): number | undefined {
  if (typeof detail === 'object' && detail !== null && key in detail) {
    const value: unknown = (detail as Record<string, unknown>)[key];
    return typeof value === 'number' ? value : undefined;
  }
  return undefined;
}

/** Mensagens pt-BR para os erros de validação do formulário (FR-006, FR-007). */
const MESSAGES: Record<string, MessageFn> = {
  required: () => 'Campo obrigatório.',
  minlength: (d) => `Informe ao menos ${numberField(d, 'requiredLength') ?? ''} caracteres.`,
  maxlength: (d) => `Use no máximo ${numberField(d, 'requiredLength') ?? ''} caracteres.`,
  email: () => 'Informe um e-mail válido.',
  pattern: () => 'Formato inválido.',
  min: (d) => `O valor mínimo é ${numberField(d, 'min') ?? ''}.`,
  max: (d) => `O valor máximo é ${numberField(d, 'max') ?? ''}.`,
  passwordComposition: () => 'A senha precisa ter ao menos uma letra e um número.',
  multipleOf: (d) => `Use múltiplos de ${numberField(d, 'step') ?? ''}.`,
  decimals: () => 'Use no máximo 2 casas decimais.',
  timeRange: () => 'O início deve ser antes do fim.',
  overlap: () => 'As faixas de horário não podem se sobrepor.',
  periodOrder: () => 'A data final deve ser posterior à inicial.',
  periodTooLong: (d) => `O período pode ter no máximo ${numberField(d, 'max') ?? ''} dias.`,
  phone: () => 'Informe um telefone válido com DDD.',
  postalCode: () => 'Informe um CEP com 8 dígitos.',
  dateInPast: () => 'Escolha uma data a partir de hoje.',
};

/** Mensagens específicas por campo, que substituem o genérico "Formato inválido.". */
export const PATTERN_MESSAGES = {
  phone: 'Informe um telefone válido com DDD.',
  state: 'Use a sigla da UF com 2 letras (ex.: SP).',
  postalCode: 'Informe um CEP com 8 dígitos.',
  localTime: 'Use o formato HH:mm.',
} as const;

/** Primeira mensagem aplicável; o erro do servidor tem prioridade. */
export function validationMessage(
  errors: ValidationErrors | null | undefined,
  patternMessage?: string,
): string | null {
  if (!errors) {
    return null;
  }
  const server: unknown = errors[SERVER_ERROR_KEY];
  if (typeof server === 'string') {
    return server;
  }
  for (const [key, detail] of Object.entries(errors)) {
    if (key === 'pattern' && patternMessage) {
      return patternMessage;
    }
    const fn = MESSAGES[key];
    if (fn) {
      return fn(detail);
    }
  }
  return 'Valor inválido.';
}
