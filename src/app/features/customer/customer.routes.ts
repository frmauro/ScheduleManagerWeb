import type { Routes } from '@angular/router';
import { APPOINTMENT_MESSAGES } from '../../core/i18n/appointments.messages';
import { CUSTOMER_MESSAGES } from '../../core/i18n/customer.messages';
import { AREA_NOT_FOUND_ROUTE } from '../errors/area-fallback.routes';

/** Área do Cliente (`/cliente`, contracts/routes.md). As notificações entram com a US7. */
export const CUSTOMER_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'agendamentos' },
  {
    path: 'agendamentos',
    title: CUSTOMER_MESSAGES.appointments.pageTitle,
    loadComponent: () =>
      import('./my-appointments.page').then((m) => m.MyAppointmentsPageComponent),
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
    path: 'perfil',
    title: CUSTOMER_MESSAGES.profile.pageTitle,
    loadComponent: () =>
      import('./customer-profile.page').then((m) => m.CustomerProfilePageComponent),
  },
  AREA_NOT_FOUND_ROUTE,
];
