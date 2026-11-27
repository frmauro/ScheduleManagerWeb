import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ProvidersApi, type AvailabilityQuery } from '../../core/api/providers.api';
import { ApiError } from '../../core/errors/api-error';
import type { AvailabilityResponse, TimeSlot } from '../../core/models/api-models';
import { addDays, todayInZone } from '../../shared/time/zoned-time';
import { AvailabilityPickerComponent } from './availability-picker.component';

const TZ = 'America/Manaus';
const DATE = addDays(todayInZone(TZ), 3);

interface Call {
  readonly providerId: string;
  readonly query: AvailabilityQuery;
  readonly reply: Subject<AvailabilityResponse>;
}

/** `ProvidersApi` falso: cada chamada fica pendente até o teste responder. */
class FakeProvidersApi {
  readonly calls: Call[] = [];

  availability(providerId: string, query: AvailabilityQuery): Subject<AvailabilityResponse> {
    const reply = new Subject<AvailabilityResponse>();
    this.calls.push({ providerId, query, reply });
    return reply;
  }

  last(): Call {
    const call = this.calls.at(-1);
    if (!call) {
      throw new Error('nenhuma chamada a availability');
    }
    return call;
  }
}

function response(slots: TimeSlot[], date = DATE): AvailabilityResponse {
  return { providerId: 'p1', serviceId: 's1', date, timeZoneId: TZ, durationMinutes: 30, slots };
}

async function setup() {
  const api = new FakeProvidersApi();
  TestBed.configureTestingModule({ providers: [{ provide: ProvidersApi, useValue: api }] });
  const fixture = TestBed.createComponent(AvailabilityPickerComponent);
  fixture.componentRef.setInput('providerId', 'p1');
  fixture.componentRef.setInput('serviceId', 's1');
  fixture.componentRef.setInput('timeZoneId', TZ);
  fixture.componentRef.setInput('date', DATE);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const respond = async (value: AvailabilityResponse | ApiError) => {
    const { reply } = api.last();
    if (value instanceof ApiError) {
      reply.error(value);
    } else {
      reply.next(value);
      reply.complete();
    }
    await fixture.whenStable();
  };
  return { fixture, api, el, respond };
}

describe('sm-availability-picker (FR-003, FR-004, FR-026, FR-031)', () => {
  it('consulta o serviço e a data pedidos', async () => {
    const { api } = await setup();
    expect(api.last().providerId).toBe('p1');
    expect(api.last().query).toEqual({ serviceId: 's1', date: DATE });
  });

  it('slots: [] mostra o estado vazio e sugere o dia seguinte', async () => {
    const { api, el, respond, fixture } = await setup();
    await respond(response([]));
    expect(el.textContent).toContain('Sem horários nesta data — escolha outra data');

    const next = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ver o dia seguinte'),
    );
    next?.click();
    await fixture.whenStable();
    expect(api.last().query.date).toBe(addDays(DATE, 1));
  });

  it('422 availability.beyond_horizon mostra a mensagem de horizonte, sem "Tentar novamente"', async () => {
    const { el, respond } = await setup();
    await respond(
      new ApiError({
        kind: 'problem',
        status: 422,
        problem: {
          type: 'about:blank',
          title: 'Unprocessable',
          status: 422,
          code: 'availability.beyond_horizon',
          traceId: 't1',
        },
      }),
    );
    expect(el.textContent).toContain(
      'O prestador ainda não abriu a agenda para esta data. Escolha uma data mais próxima.',
    );
    expect(el.textContent).not.toContain('Tentar novamente');
  });

  it('exibe os horários no fuso do prestador e emite o startAt intacto', async () => {
    const { fixture, el, respond } = await setup();
    const startAt = `${DATE}T09:00:00-04:00`;
    await respond(response([{ startAt, endAt: `${DATE}T09:30:00-04:00` }]));

    const button = el.querySelector<HTMLButtonElement>('ul button');
    // 09:00 em Manaus, qualquer que seja o fuso de quem roda o teste.
    expect(button?.textContent?.trim()).toBe('09:00');

    const emitted: TimeSlot[] = [];
    fixture.componentInstance.slotSelected.subscribe((s) => emitted.push(s));
    button?.click();
    expect(emitted[0]?.startAt).toBe(startAt);
  });

  it('limita o seletor de data de hoje (no fuso) até +365 dias', async () => {
    const { el } = await setup();
    const input = el.querySelector<HTMLInputElement>('input[type="date"]');
    expect(input?.min).toBe(todayInZone(TZ));
    expect(input?.max).toBe(addDays(todayInZone(TZ), 365));
  });
});
