import { HttpStatusCode } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of, shareReplay, throwError, type Observable } from 'rxjs';
import { isApiError } from '../errors/api-error';
import type { Uuid } from '../models/api-models';
import { ProvidersApi } from './providers.api';

export interface ProviderZone {
  readonly timeZoneId: string;
  readonly displayName: string;
}

/**
 * Fuso e nome de cada prestador para as listas do cliente (R18, lacuna 9 da spec): o
 * `AppointmentSummary` não traz `timeZoneId`, então cada `providerId` distinto é resolvido uma
 * única vez por sessão via #9 (público). `null` = prestador desativado ou inexistente (`404`).
 */
@Injectable({ providedIn: 'root' })
export class ProviderTimeZoneCache {
  private readonly providers = inject(ProvidersApi);
  private readonly entries = new Map<Uuid, Observable<ProviderZone | null>>();

  get(providerId: Uuid): Observable<ProviderZone | null> {
    let entry = this.entries.get(providerId);
    if (!entry) {
      entry = this.providers.getPublic(providerId).pipe(
        map((p): ProviderZone | null => ({ timeZoneId: p.timeZoneId, displayName: p.displayName })),
        catchError((error: unknown) => {
          if (isApiError(error) && error.status === (HttpStatusCode.NotFound as number)) {
            return of(null);
          }
          this.entries.delete(providerId); // falha transitória: tenta de novo na próxima vez
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.entries.set(providerId, entry);
    }
    return entry;
  }

  /** Esquece tudo (ex.: ao sair da conta). */
  clear(): void {
    this.entries.clear();
  }
}
