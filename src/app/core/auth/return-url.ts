import type { Role } from '../models/enums';

/** Rotas de área por perfil (contracts/routes.md). */
export const AREA_PREFIX: Record<Role, string> = {
  Customer: '/cliente',
  Provider: '/prestador',
  Admin: '/admin',
};

export const HOME_BY_ROLE: Record<Role, string> = {
  Customer: '/cliente/agendamentos',
  Provider: '/prestador',
  Admin: '/admin/usuarios',
};

const AUTH_PATHS = ['/entrar', '/cadastro'] as const;

function pathOf(url: string): string {
  const end = url.search(/[?#]/);
  return end === -1 ? url : url.slice(0, end);
}

function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/**
 * Aceita só caminhos internos: começa com `/`, não com `//` nem `/\`, e não aponta para
 * login/cadastro. Protege contra *open redirect* (research R11).
 */
export function sanitizeReturnUrl(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }
  const path = pathOf(value);
  if (AUTH_PATHS.some((p) => isUnder(path, p))) {
    return null;
  }
  return value;
}

export function homeForRole(role: Role): string {
  return HOME_BY_ROLE[role];
}

/** Uma URL de área (`/cliente`, `/prestador`, `/admin`) só serve ao próprio perfil. */
export function isUrlAllowedForRole(url: string, role: Role): boolean {
  const path = pathOf(url);
  return (Object.entries(AREA_PREFIX) as [Role, string][]).every(
    ([areaRole, prefix]) => !isUnder(path, prefix) || areaRole === role,
  );
}

/** Destino após o login (FR-016): `returnUrl` válido e compatível, senão a home do perfil. */
export function resolvePostLoginUrl(returnUrl: string | null | undefined, role: Role): string {
  const safe = sanitizeReturnUrl(returnUrl);
  return safe !== null && isUrlAllowedForRole(safe, role) ? safe : homeForRole(role);
}
