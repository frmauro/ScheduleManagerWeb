import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of, type Observable } from 'rxjs';
import { CustomersApi, type CustomerAppointmentsQuery } from '../../core/api/customers.api';
import { ProviderTimeZoneCache, type ProviderZone } from '../../core/api/provider-time-zone.cache';
import type { AppointmentSummary, Page } from '../../core/models/api-models';
import { MyAppointmentsPageComponent, tabRange } from './my-appointments.page';

registerLocaleData(localePt);

const OFFSET_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

const ITEM: AppointmentSummary = {
  id: 'a1',
  providerId: 'p1',
  providerName: 'Barbearia',
  customerId: 'c1',
  customerName: 'Ana',
  serviceName: 'Corte',
  startAt: '2026-12-01T12:00:00Z',
  endAt: '2026-12-01T12:30:00Z',
  status: 'CancelledByProvider',
};

class FakeCustomersApi {
  readonly queries: CustomerAppointmentsQuery[] = [];
  items: AppointmentSummary[] = [ITEM];
  listMyAppointments(query: CustomerAppointmentsQuery): Observable<Page<AppointmentSummary>> {
    this.queries.push(query);
    return of({
      items: this.items,
      page: 1,
      pageSize: 20,
      totalCount: this.items.length,
      totalPages: 1,
    });
  }
  last(): CustomerAppointmentsQuery {
    const q = this.queries.at(-1);
    if (!q) {
      throw new Error('nenhuma consulta');
    }
    return q;
  }
}

class FakeZoneCache {
  zones: Record<string, ProviderZone | null> = {
    p1: { timeZoneId: 'America/Manaus', displayName: 'Barbearia' },
  };
  get(id: string): Observable<ProviderZone | null> {
    return of(this.zones[id] ?? null);
  }
}

async function setup(url = '/', zoneMap?: Record<string, ProviderZone | null>) {
  const api = new FakeCustomersApi();
  const zones = new FakeZoneCache();
  if (zoneMap) {
    zones.zones = zoneMap;
  }
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '', component: MyAppointmentsPageComponent }]),
      { provide: CustomersApi, useValue: api },
      { provide: ProviderTimeZoneCache, useValue: zones },
    ],
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, MyAppointmentsPageComponent);
  harness.detectChanges();
  return { api, zones, harness, root: harness.routeNativeElement as HTMLElement };
}

describe('MyAppointmentsPageComponent (FR-032)', () => {
  it('"Próximos" consulta from=agora com offset e sort=startAt, sem status por padrão', async () => {
    const before = Date.now();
    const { api } = await setup();
    const q = api.last();
    expect(q.from).toMatch(OFFSET_ISO);
    expect(Date.parse(q.from ?? '')).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    expect(q.to).toBeUndefined();
    expect(q.sort).toBe('startAt');
    expect(q.status).toEqual([]);
  });

  it('cancelados futuros aparecem com o selo', async () => {
    const { root } = await setup();
    const item = root.querySelector('[data-testid="my-appointment"]');
    expect(item?.textContent).toContain('Cancelado pelo prestador');
  });

  it('"Histórico" consulta to=agora com offset e sort=-startAt', async () => {
    const { api } = await setup('/?aba=historico');
    const q = api.last();
    expect(q.to).toMatch(OFFSET_ISO);
    expect(q.from).toBeUndefined();
    expect(q.sort).toBe('-startAt');
  });

  it('a aba fica na URL (aba=historico)', async () => {
    const { harness, api } = await setup();
    const tab = Array.from(
      (harness.routeNativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      ),
    ).find((b) => b.textContent?.includes('Histórico'));
    tab?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/?aba=historico');
    expect(api.last().sort).toBe('-startAt');
  });

  it('mostra a data no fuso do prestador; 404 → fuso do dispositivo com "no seu fuso"', async () => {
    const ctx = await setup();
    const when = ctx.root.querySelector('[data-testid="my-appointment-when"]');
    // 12:00 UTC = 08:00 em Manaus.
    expect(when?.textContent).toContain('01/12/2026 08:00');

    TestBed.resetTestingModule();
    const other = (await setup('/', {})).root;
    expect(other.querySelector('[data-testid="my-appointment-when"]')?.textContent).toContain(
      'no seu fuso',
    );
  });

  it('filtro de prestador via ?prestador= aparece como rótulo removível com o nome', async () => {
    const { api, root, harness } = await setup('/?prestador=p1');
    expect(api.last().providerId).toBe('p1');
    expect(root.querySelector('[data-testid="provider-filter"]')?.textContent).toContain(
      'Prestador: Barbearia',
    );
    root
      .querySelector<HTMLButtonElement>('[aria-label="Remover o filtro do prestador Barbearia"]')
      ?.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('período inválido mostra o erro no filtro e não consulta', async () => {
    const { api, root } = await setup('/?de=2026-12-10&ate=2026-12-01');
    expect(api.queries).toHaveLength(0);
    expect(root.querySelector('[data-testid="period-error"]')?.textContent).toContain('data final');
  });
});

describe('tabRange', () => {
  const NOW = Date.parse('2026-12-01T15:00:00Z');
  const TZ = 'America/Sao_Paulo';

  it('"Próximos" com `de` no futuro começa em `de`; `ate` vira o dia seguinte exclusivo', () => {
    expect(tabRange({ aba: 'proximos', de: '2026-12-10', ate: '2026-12-11' }, NOW, TZ)).toEqual({
      from: '2026-12-10T00:00:00-03:00',
      to: '2026-12-12T00:00:00-03:00',
    });
  });

  it('"Histórico" termina agora mesmo com `ate` no futuro', () => {
    expect(tabRange({ aba: 'historico', de: '2026-11-01', ate: '2026-12-31' }, NOW, TZ)).toEqual({
      from: '2026-11-01T00:00:00-03:00',
      to: '2026-12-01T12:00:00-03:00',
    });
  });

  it('período inteiramente no passado em "Próximos" → vazio, sem consulta', () => {
    expect(tabRange({ aba: 'proximos', de: '2026-11-01', ate: '2026-11-02' }, NOW, TZ)).toBeNull();
  });
});
