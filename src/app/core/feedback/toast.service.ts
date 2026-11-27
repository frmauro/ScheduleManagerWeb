import { inject, Injectable, Injector, signal } from '@angular/core';

export type ToastTone = 'info' | 'success' | 'error';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

/** Duração padrão de um aviso temporário. */
export const TOAST_DURATION_MS = 6000;

/**
 * Avisos temporários (contracts/error-catalog.md, apresentação "toast"), anunciados a leitores
 * de tela via `LiveAnnouncer` do CDK (FR-011). O CDK de acessibilidade é carregado sob demanda
 * para não entrar no bundle inicial (orçamento do plano).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly injector = inject(Injector);
  private readonly items = signal<readonly Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  show(message: string, tone: ToastTone = 'info', durationMs = TOAST_DURATION_MS): number {
    const toast: Toast = { id: this.nextId++, message, tone };
    this.items.update((list) => [...list, toast]);
    void this.announce(message, tone);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(toast.id), durationMs);
    }
    return toast.id;
  }

  error(message: string): number {
    return this.show(message, 'error');
  }

  success(message: string): number {
    return this.show(message, 'success');
  }

  private async announce(message: string, tone: ToastTone): Promise<void> {
    const { LiveAnnouncer } = await import('@angular/cdk/a11y');
    await this.injector
      .get(LiveAnnouncer)
      .announce(message, tone === 'error' ? 'assertive' : 'polite');
  }

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
