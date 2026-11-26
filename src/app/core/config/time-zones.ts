import { DEFAULT_TIME_ZONE } from './app.constants';

export interface TimeZoneOption {
  readonly id: string;
  readonly label: string;
  readonly featured: boolean;
}

/** Fusos brasileiros em destaque (FR-007, FR-014). */
const BRAZIL_TIME_ZONES: readonly { id: string; label: string }[] = [
  { id: DEFAULT_TIME_ZONE, label: 'Brasília / São Paulo' },
  { id: 'America/Manaus', label: 'Manaus' },
  { id: 'America/Belem', label: 'Belém' },
  { id: 'America/Fortaleza', label: 'Fortaleza' },
  { id: 'America/Recife', label: 'Recife' },
  { id: 'America/Bahia', label: 'Salvador' },
  { id: 'America/Cuiaba', label: 'Cuiabá' },
  { id: 'America/Campo_Grande', label: 'Campo Grande' },
  { id: 'America/Porto_Velho', label: 'Porto Velho' },
  { id: 'America/Boa_Vista', label: 'Boa Vista' },
  { id: 'America/Rio_Branco', label: 'Rio Branco' },
  { id: 'America/Noronha', label: 'Fernando de Noronha' },
  { id: 'America/Araguaina', label: 'Araguaína' },
  { id: 'America/Maceio', label: 'Maceió' },
  { id: 'America/Santarem', label: 'Santarém' },
  { id: 'America/Eirunepe', label: 'Eirunepé' },
];

function otherTimeZones(): string[] {
  const featured = new Set(BRAZIL_TIME_ZONES.map((z) => z.id));
  return Intl.supportedValuesOf('timeZone').filter((id) => !featured.has(id));
}

export const TIME_ZONE_OPTIONS: readonly TimeZoneOption[] = [
  ...BRAZIL_TIME_ZONES.map((z) => ({ id: z.id, label: `${z.label} (${z.id})`, featured: true })),
  ...otherTimeZones().map((id) => ({ id, label: id.replaceAll('_', ' '), featured: false })),
];

export function isKnownTimeZone(id: string): boolean {
  return TIME_ZONE_OPTIONS.some((z) => z.id === id);
}
