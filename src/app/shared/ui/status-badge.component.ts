import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideDynamicIcon } from '@lucide/angular';
import type { AppointmentStatus } from '../../core/models/enums';
import {
  APPOINTMENT_STATUS_LABELS,
  STATUS_VISUALS,
  type StatusTone,
} from '../../core/models/labels';

/** Selo de status com ícone **e** texto, nunca só cor (FR-009). */
@Component({
  selector: 'sm-status-badge',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
      [class]="toneClasses()"
      [attr.data-status]="status()"
    >
      <svg [lucideIcon]="visual().icon" [size]="14" aria-hidden="true"></svg>
      {{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<AppointmentStatus>();

  protected readonly visual = computed(() => STATUS_VISUALS[this.status()]);
  protected readonly label = computed(() => APPOINTMENT_STATUS_LABELS[this.status()]);
  protected readonly toneClasses = computed(() => TONE_CLASSES[this.visual().tone]);
}

/** Classes completas (o Tailwind só gera classes escritas por extenso no código). */
const TONE_CLASSES: Record<StatusTone, string> = {
  warning: 'bg-tone-warning-bg text-tone-warning-fg ring-1 ring-tone-warning-fg',
  success: 'bg-tone-success-bg text-tone-success-fg',
  danger: 'bg-tone-danger-bg text-tone-danger-fg',
  neutral: 'bg-tone-neutral-bg text-tone-neutral-fg',
  info: 'bg-tone-info-bg text-tone-info-fg',
};
