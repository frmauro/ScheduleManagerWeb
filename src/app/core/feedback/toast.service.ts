import { LiveAnnouncer } from '@angular/cdk/a11y';
import { inject, Injectable, signal } from '@angular/core';

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
 * de tela via `LiveAnnouncer` do CDK (FR-011).
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly items = signal<readonly Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.items.asReadonly();

  show(message: string, tone: ToastTone = 'info', durationMs = TOAST_DURATION_MS): number {
    const toast: Toast = { id: this.nextId++, message, tone };
    this.items.update((list) => [...list, toast]);
    void this.announcer.announce(message, tone === 'error' ? 'assertive' : 'polite');
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

  dismiss(id: number): void {
    this.items.update((list) => list.filter((t) => t.id !== id));
  }
}
