import { computed, Injectable, signal } from '@angular/core';
import { jwtDecode } from 'jwt-decode';
import { MS_PER_MINUTE, SESSION_WARNING_MINUTES, STORAGE_KEYS } from '../config/app.constants';
import { isOneOf, ROLE_VALUES, type Role } from '../models/enums';
import type { AuthResponse, CurrentUser, Instant } from '../models/api-models';

/** Sessão do navegador (data-model §4). Nunca vai para URL nem para logs (FR-021). */
export interface Session {
  readonly accessToken: string;
  readonly expiresAt: Instant;
  readonly user: CurrentUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCurrentUser(value: unknown): value is CurrentUser {
  return (
    isRecord(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['email'] === 'string' &&
    isOneOf<Role>(ROLE_VALUES, value['role'])
  );
}

function isSession(value: unknown): value is Session {
  return (
    isRecord(value) &&
    typeof value['accessToken'] === 'string' &&
    typeof value['expiresAt'] === 'string' &&
    !Number.isNaN(Date.parse(value['expiresAt'])) &&
    isCurrentUser(value['user'])
  );
}

/** Lê o `exp` do JWT só como checagem de consistência (R6); `expiresAt` da API comanda. */
function jwtAlreadyExpired(token: string, now: number): boolean {
  try {
    const { exp } = jwtDecode(token);
    return typeof exp === 'number' && exp * 1000 <= now;
  } catch {
    return false;
  }
}

function storage(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Sessão em memória (signals) espelhada em `sessionStorage['sm.session']`: sobrevive ao
 * recarregamento na mesma aba e some ao fechá-la (FR-018, research R6).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly state = signal<Session | null>(null);
  private readonly warnedState = signal(false);

  readonly session = this.state.asReadonly();
  readonly warned = this.warnedState.asReadonly();
  readonly user = computed(() => this.state()?.user ?? null);
  readonly role = computed<Role | null>(() => this.state()?.user.role ?? null);
  readonly accessToken = computed(() => this.state()?.accessToken ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  /** Momento (ms) em que expira; `null` sem sessão. */
  readonly expiresAtMs = computed(() => {
    const session = this.state();
    return session ? Date.parse(session.expiresAt) : null;
  });
  /** Momento (ms) do aviso de expiração: `expiresAt − 5 min` (FR-017a). */
  readonly warningAt = computed(() => {
    const expires = this.expiresAtMs();
    return expires === null ? null : expires - SESSION_WARNING_MINUTES * MS_PER_MINUTE;
  });

  start(auth: AuthResponse): void {
    const session: Session = {
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
      user: auth.user,
    };
    this.warnedState.set(false);
    this.state.set(session);
    this.persist(session);
  }

  /** Restaura do `sessionStorage`; descarta sessão inválida ou expirada. */
  restore(): Session | null {
    const raw = storage()?.getItem(STORAGE_KEYS.session) ?? null;
    if (raw === null) {
      return null;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.clear();
      return null;
    }
    const now = Date.now();
    if (
      !isSession(parsed) ||
      Date.parse(parsed.expiresAt) <= now ||
      jwtAlreadyExpired(parsed.accessToken, now)
    ) {
      this.clear();
      return null;
    }
    this.state.set(parsed);
    return parsed;
  }

  /** Atualiza os dados do usuário (ex.: após `GET /auth/me` ou edição de perfil). */
  updateUser(user: CurrentUser): void {
    const current = this.state();
    if (!current) {
      return;
    }
    const next: Session = { ...current, user };
    this.state.set(next);
    this.persist(next);
  }

  isExpired(now: number = Date.now()): boolean {
    const expires = this.expiresAtMs();
    return expires === null || now >= expires;
  }

  markWarned(): void {
    this.warnedState.set(true);
  }

  clear(): void {
    this.state.set(null);
    this.warnedState.set(false);
    try {
      storage()?.removeItem(STORAGE_KEYS.session);
    } catch {
      // Storage indisponível (modo privado/bloqueado): a sessão em memória já foi descartada.
    }
  }

  private persist(session: Session): void {
    try {
      storage()?.setItem(STORAGE_KEYS.session, JSON.stringify(session));
    } catch {
      // Sem storage, a sessão vale só em memória (não sobrevive ao recarregamento).
    }
  }
}
