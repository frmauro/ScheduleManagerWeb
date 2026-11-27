import type { Routes } from '@angular/router';
import { providerHomeGuard } from '../../core/auth/provider-home.guard';
import { APPOINTMENT_MESSAGES } from '../../core/i18n/appointments.messages';
import { PROVIDER_MESSAGES } from '../../core/i18n/provider.messages';
import { AREA_NOT_FOUND_ROUTE } from '../errors/area-fallback.routes';

const T = PROVIDER_MESSAGES;

/** Área do Prestador (`/prestador`, contracts/routes.md). */
export const PROVIDER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', canActivate: [providerHomeGuard], children: [] },
  {
    path: 'primeiros-passos',
    title: T.setup.pageTitle,
    loadComponent: () =>
      import('./setup/setup-checklist.page').then((m) => m.SetupChecklistPageComponent),
  },
  {
    path: 'agenda',
    title: T.agenda.pageTitle,
    loadComponent: () => import('./agenda/agenda.page').then((m) => m.AgendaPageComponent),
  },
  {
    path: 'agendamentos/:id',
    title: APPOINTMENT_MESSAGES.pageTitle,
    loadComponent: () =>
      import('../appointments/appointment-detail.page').then(
        (m) => m.AppointmentDetailPageComponent,
      ),
  },
  {
    path: 'servicos',
    title: T.services.pageTitle,
    loadComponent: () => import('./services/services.page').then((m) => m.ServicesPageComponent),
  },
  {
    path: 'expediente',
    title: T.schedule.pageTitle,
    loadComponent: () => import('./schedule/schedule.page').then((m) => m.SchedulePageComponent),
  },
  {
    path: 'excecoes',
    title: T.exceptions.pageTitle,
    loadComponent: () =>
      import('./exceptions/exceptions.page').then((m) => m.ExceptionsPageComponent),
  },
  {
    path: 'politica',
    title: T.policy.pageTitle,
    loadComponent: () =>
      import('./booking-policy/booking-policy.page').then((m) => m.BookingPolicyPageComponent),
  },
  {
    path: 'estabelecimento',
    title: T.establishment.pageTitle,
    loadComponent: () =>
      import('./establishment/establishment.page').then((m) => m.EstablishmentPageComponent),
  },
  AREA_NOT_FOUND_ROUTE,
];
