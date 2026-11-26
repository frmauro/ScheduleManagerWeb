/**
 * Única fonte das rotas da API `/api/v1` (Art. III.2; contracts/api-services.md).
 * Os caminhos são relativos: o `apiBaseUrlInterceptor` acrescenta o prefixo.
 */
import type { Uuid } from '../models/api-models';

const id = (value: Uuid): string => encodeURIComponent(value);

export const API = {
  auth: {
    registerCustomer: '/auth/register/customer',
    registerProvider: '/auth/register/provider',
    login: '/auth/login',
    me: '/auth/me',
  },
  customers: {
    me: '/customers/me',
    myAppointments: '/customers/me/appointments',
  },
  providers: {
    search: '/providers',
    byId: (providerId: Uuid) => `/providers/${id(providerId)}`,
    me: '/providers/me',
    myBookingPolicy: '/providers/me/booking-policy',
    myAppointments: '/providers/me/appointments',
    publicServices: (providerId: Uuid) => `/providers/${id(providerId)}/services`,
    availability: (providerId: Uuid) => `/providers/${id(providerId)}/availability`,
  },
  services: {
    mine: '/providers/me/services',
    byId: (serviceId: Uuid) => `/providers/me/services/${id(serviceId)}`,
    status: (serviceId: Uuid) => `/providers/me/services/${id(serviceId)}/status`,
  },
  schedule: {
    weekly: '/providers/me/schedule',
    workingHours: '/providers/me/schedule/working-hours',
    exceptions: '/providers/me/schedule/exceptions',
    exceptionById: (exceptionId: Uuid) => `/providers/me/schedule/exceptions/${id(exceptionId)}`,
  },
  appointments: {
    create: '/appointments',
    byId: (appointmentId: Uuid) => `/appointments/${id(appointmentId)}`,
    confirm: (appointmentId: Uuid) => `/appointments/${id(appointmentId)}/confirm`,
    cancel: (appointmentId: Uuid) => `/appointments/${id(appointmentId)}/cancel`,
    complete: (appointmentId: Uuid) => `/appointments/${id(appointmentId)}/complete`,
  },
  notifications: {
    mine: '/notifications/me',
  },
  admin: {
    users: '/admin/users',
    userStatus: (userId: Uuid) => `/admin/users/${id(userId)}/status`,
    notifications: '/admin/notifications',
  },
} as const;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface EndpointInventoryItem {
  readonly id: number;
  readonly method: HttpMethod;
  /** Caminho do contrato, com parâmetros no formato `{nome}`. */
  readonly path: string;
}

/** As 34 operações do contrato (spec, Apêndice A). Verificado em `endpoint-inventory.spec.ts`. */
export const ENDPOINT_INVENTORY: readonly EndpointInventoryItem[] = [
  { id: 1, method: 'POST', path: '/auth/register/customer' },
  { id: 2, method: 'POST', path: '/auth/register/provider' },
  { id: 3, method: 'POST', path: '/auth/login' },
  { id: 4, method: 'GET', path: '/auth/me' },
  { id: 5, method: 'GET', path: '/customers/me' },
  { id: 6, method: 'PUT', path: '/customers/me' },
  { id: 7, method: 'GET', path: '/customers/me/appointments' },
  { id: 8, method: 'GET', path: '/providers' },
  { id: 9, method: 'GET', path: '/providers/{providerId}' },
  { id: 10, method: 'GET', path: '/providers/me' },
  { id: 11, method: 'PUT', path: '/providers/me' },
  { id: 12, method: 'PUT', path: '/providers/me/booking-policy' },
  { id: 13, method: 'GET', path: '/providers/me/appointments' },
  { id: 14, method: 'GET', path: '/providers/{providerId}/services' },
  { id: 15, method: 'GET', path: '/providers/me/services' },
  { id: 16, method: 'POST', path: '/providers/me/services' },
  { id: 17, method: 'PUT', path: '/providers/me/services/{serviceId}' },
  { id: 18, method: 'DELETE', path: '/providers/me/services/{serviceId}' },
  { id: 19, method: 'PATCH', path: '/providers/me/services/{serviceId}/status' },
  { id: 20, method: 'GET', path: '/providers/me/schedule' },
  { id: 21, method: 'PUT', path: '/providers/me/schedule/working-hours' },
  { id: 22, method: 'GET', path: '/providers/me/schedule/exceptions' },
  { id: 23, method: 'POST', path: '/providers/me/schedule/exceptions' },
  { id: 24, method: 'DELETE', path: '/providers/me/schedule/exceptions/{exceptionId}' },
  { id: 25, method: 'GET', path: '/providers/{providerId}/availability' },
  { id: 26, method: 'POST', path: '/appointments' },
  { id: 27, method: 'GET', path: '/appointments/{appointmentId}' },
  { id: 28, method: 'POST', path: '/appointments/{appointmentId}/confirm' },
  { id: 29, method: 'POST', path: '/appointments/{appointmentId}/cancel' },
  { id: 30, method: 'POST', path: '/appointments/{appointmentId}/complete' },
  { id: 31, method: 'GET', path: '/notifications/me' },
  { id: 32, method: 'GET', path: '/admin/users' },
  { id: 33, method: 'PATCH', path: '/admin/users/{userId}/status' },
  { id: 34, method: 'GET', path: '/admin/notifications' },
];
