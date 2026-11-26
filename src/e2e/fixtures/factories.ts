import type {
  Appointment,
  AuthResponse,
  AvailabilityResponse,
  BookingPolicy,
  LocalDate,
  ProviderProfile,
  RegisterProviderRequest,
  Service,
  ServiceRequest,
  WeeklyScheduleDay,
} from '../../app/core/models/api-models';
import type { DayOfWeek, ServiceCategory } from '../../app/core/models/enums';
import { addDays, dayOfWeekOf, offsetMinutes, todayInZone } from '../../app/shared/time/zoned-time';
import { ApiClient } from './api-client';

/**
 * Dados dos cenários E2E criados pela API real, com e-mails únicos por execução, sem depender
 * de estado prévio além do Admin provisionado (quickstart §6).
 */
export const DEFAULT_PASSWORD = 'Senha12345';
export const ADMIN_CREDENTIALS = { email: 'admin@schedulemanager.local', password: 'Admin12345' };

const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let sequence = 0;

export function uniqueEmail(prefix: string): string {
  sequence += 1;
  return `e2e.${prefix}.${RUN_ID}.${sequence}@example.com`;
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${RUN_ID}-${sequence + 1}`;
}

export interface Actor {
  readonly auth: AuthResponse;
  readonly email: string;
  readonly password: string;
  readonly api: ApiClient;
}

export interface ProviderActor extends Actor {
  readonly providerId: string;
  readonly displayName: string;
  readonly timeZoneId: string;
}

export interface ProviderOptions {
  readonly timeZoneId?: string;
  readonly category?: ServiceCategory;
  readonly city?: string;
  readonly state?: string;
  readonly displayName?: string;
  readonly policy?: Partial<BookingPolicy>;
}

export async function createProvider(options: ProviderOptions = {}): Promise<ProviderActor> {
  const email = uniqueEmail('provider');
  const timeZoneId = options.timeZoneId ?? 'America/Sao_Paulo';
  const displayName = options.displayName ?? uniqueName('Estabelecimento E2E');
  const body: RegisterProviderRequest = {
    name: 'Prestador E2E',
    email,
    password: DEFAULT_PASSWORD,
    displayName,
    description: 'Criado pelos testes ponta a ponta.',
    category: options.category ?? 'Barbershop',
    contactPhone: '+5511999998888',
    address: {
      street: 'Rua dos Testes',
      number: '100',
      complement: null,
      district: 'Centro',
      city: options.city ?? 'São Paulo',
      state: options.state ?? 'SP',
      postalCode: '01001000',
    },
    timeZoneId,
  };
  const anonymous = await ApiClient.create();
  const auth = await anonymous.post<AuthResponse>('/auth/register/provider', body);
  await anonymous.dispose();
  const api = await ApiClient.create(auth.accessToken);
  const providerId = auth.user.providerId ?? '';
  if (options.policy) {
    const me = await api.get<ProviderProfile>('/providers/me');
    await api.put<BookingPolicy>('/providers/me/booking-policy', {
      ...me.bookingPolicy,
      ...options.policy,
    });
  }
  return { auth, email, password: DEFAULT_PASSWORD, api, providerId, displayName, timeZoneId };
}

export function createService(
  provider: ProviderActor,
  overrides: Partial<ServiceRequest> = {},
): Promise<Service> {
  return provider.api.post<Service>('/providers/me/services', {
    name: overrides.name ?? uniqueName('Corte'),
    description: overrides.description ?? null,
    durationMinutes: overrides.durationMinutes ?? 30,
    price: overrides.price ?? 50,
  });
}

/** Expediente padrão: segunda a sexta 09:00–12:00 e 13:00–18:00 (cenário 8). */
export const WEEKDAYS_WITH_LUNCH: WeeklyScheduleDay[] = (
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
).map((dayOfWeek) => ({
  dayOfWeek,
  intervals: [
    { start: '09:00', end: '12:00' },
    { start: '13:00', end: '18:00' },
  ],
}));

export async function setWorkingHours(
  provider: ProviderActor,
  days: WeeklyScheduleDay[] = WEEKDAYS_WITH_LUNCH,
): Promise<void> {
  await provider.api.put('/providers/me/schedule/working-hours', { days });
}

/**
 * Expediente 00:00–23:55 em todos os dias, no fuso do prestador: cobre o "agora" (cenários 7 e
 * 11) e também agendamentos em dias seguintes ("daqui a 3 dias").
 */
export async function setWorkingHoursCoveringNow(provider: ProviderActor): Promise<void> {
  const allDay = DAY_OF_WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    intervals: [{ start: '00:00', end: '23:55' }],
  }));
  await setWorkingHours(provider, allDay);
}

const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** Minutos que faltam para a meia-noite no fuso (para pular testes sensíveis à virada do dia). */
export function minutesUntilMidnight(timeZone: string, now: number = Date.now()): number {
  const local = new Date(now + offsetMinutes(now, timeZone) * 60_000);
  return 24 * 60 - (local.getUTCHours() * 60 + local.getUTCMinutes());
}

/** Próxima data (a partir de amanhã) que cai no dia da semana pedido, no fuso. */
export function nextWeekday(dayOfWeek: DayOfWeek, timeZone: string): LocalDate {
  let date = addDays(todayInZone(timeZone), 1);
  while (dayOfWeekOf(date) !== dayOfWeek) {
    date = addDays(date, 1);
  }
  return date;
}

export async function createCustomer(): Promise<Actor> {
  const email = uniqueEmail('customer');
  const anonymous = await ApiClient.create();
  const auth = await anonymous.post<AuthResponse>('/auth/register/customer', {
    name: 'Cliente E2E',
    email,
    password: DEFAULT_PASSWORD,
    phone: '+5511988887777',
  });
  await anonymous.dispose();
  return { auth, email, password: DEFAULT_PASSWORD, api: await ApiClient.create(auth.accessToken) };
}

export async function loginAsAdmin(): Promise<Actor> {
  const anonymous = await ApiClient.create();
  const auth = await anonymous.post<AuthResponse>('/auth/login', ADMIN_CREDENTIALS);
  await anonymous.dispose();
  return { auth, ...ADMIN_CREDENTIALS, api: await ApiClient.create(auth.accessToken) };
}

export async function getAvailability(
  providerId: string,
  serviceId: string,
  date: LocalDate,
): Promise<AvailabilityResponse> {
  const anonymous = await ApiClient.create();
  const result = await anonymous.get<AvailabilityResponse>(
    `/providers/${providerId}/availability`,
    {
      serviceId,
      date,
    },
  );
  await anonymous.dispose();
  return result;
}

export function bookAppointment(
  customer: Actor,
  body: { providerId: string; serviceId: string; startAt: string; notes?: string },
): Promise<Appointment> {
  return customer.api.post<Appointment>('/appointments', body, {
    'Idempotency-Key': crypto.randomUUID(),
  });
}

/** Reserva o primeiro horário livre de uma data (o `startAt` vai intacto, FR-026). */
export async function bookFirstSlot(
  customer: Actor,
  provider: ProviderActor,
  service: Service,
  date: LocalDate,
): Promise<Appointment> {
  const availability = await getAvailability(provider.providerId, service.id, date);
  const slot = availability.slots[0];
  if (!slot) {
    throw new Error(`Sem horários em ${date} para o serviço ${service.id}`);
  }
  return bookAppointment(customer, {
    providerId: provider.providerId,
    serviceId: service.id,
    startAt: slot.startAt,
  });
}
