/**
 * Opções tipadas para `<select class="sm-select" smFieldControl>` nativo (T055): o select nativo
 * mantém o melhor suporte de teclado e leitor de tela no celular; o estilo vem de `.sm-select`.
 */
export interface SelectOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

export function enumOptions<T extends string>(
  values: readonly T[],
  labels: Readonly<Record<T, string>>,
): readonly SelectOption<T>[] {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** UFs brasileiras para o endereço. */
export const BRAZIL_STATES = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;
