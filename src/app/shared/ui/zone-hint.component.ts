import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { LucideClock, LucideDynamicIcon } from '@lucide/angular';
import { COMMON_MESSAGES } from '../../core/i18n/common.messages';
import { isDifferentFromBrowser, zoneLabel } from '../time/zoned-time';

/**
 * Indica o fuso do prestador (ex.: "Horário de Manaus (GMT-04:00)") **somente** quando ele
 * difere do fuso do dispositivo (FR-003, SC-003).
 */
@Component({
  selector: 'sm-zone-hint',
  standalone: true,
  imports: [LucideDynamicIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <span class="inline-flex items-center gap-1 text-sm text-gray-700" data-testid="zone-hint">
        <svg [lucideIcon]="icon" [size]="14" aria-hidden="true"></svg>
        {{ text() }}
      </span>
    }
  `,
})
export class ZoneHintComponent {
  readonly timeZone = input.required<string>();
  /** Instante de referência para o offset (horário de verão). */
  readonly at = input<string | null>(null);
  /** Mostra mesmo quando coincide com o navegador (ex.: página do prestador). */
  readonly always = input(false);

  protected readonly icon = LucideClock;
  protected readonly visible = computed(
    () => this.always() || isDifferentFromBrowser(this.timeZone()),
  );
  protected readonly text = computed(() => {
    const at = this.at();
    const label = zoneLabel(this.timeZone(), at ? new Date(at) : new Date());
    return COMMON_MESSAGES.timeZone.providerTime(label);
  });
}
