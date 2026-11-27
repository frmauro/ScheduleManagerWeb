import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../../core/api/auth.api';
import { AuthFlowService } from '../../core/auth/auth-flow.service';
import { APP_PATHS } from '../../core/config/app-paths';
import { DEFAULT_TIME_ZONE } from '../../core/config/app.constants';
import { TIME_ZONE_OPTIONS } from '../../core/config/time-zones';
import { AUTH_MESSAGES } from '../../core/i18n/auth.messages';
import type { RegisterProviderRequest } from '../../core/models/api-models';
import { SERVICE_CATEGORY_VALUES, isOneOf, type ServiceCategory } from '../../core/models/enums';
import { SERVICE_CATEGORY_LABELS } from '../../core/models/labels';
import {
  AddressFormComponent,
  createAddressForm,
  toAddress,
} from '../../shared/forms/address-form.component';
import { PhoneBrDirective } from '../../shared/forms/phone-br.directive';
import { PATTERN_MESSAGES } from '../../shared/forms/validation-messages';
import { SmValidators } from '../../shared/forms/validators';
import { ButtonDirective } from '../../shared/ui/button.directive';
import { FieldComponent, FieldControlDirective } from '../../shared/ui/field.component';
import { FormErrorSummaryComponent } from '../../shared/ui/form-error-summary.component';
import { enumOptions } from '../../shared/ui/select-options';
import { handleAuthFormError } from './auth-form-errors';

export const PROVIDER_STEPS = ['conta', 'estabelecimento', 'endereco'] as const;
export type ProviderStep = (typeof PROVIDER_STEPS)[number];

/**
 * Campos de cada etapa, pelo caminho que a API usa em `errors` (`name`, `address.city`…):
 * o formulário é plano para que `applyServerErrors` encontre cada campo.
 */
const STEP_FIELDS: Record<ProviderStep, readonly string[]> = {
  conta: ['name', 'email', 'password'],
  estabelecimento: [
    'displayName',
    'description',
    'category',
    'contactEmail',
    'contactPhone',
    'timeZoneId',
  ],
  endereco: ['address'],
};

/** Etapa de um caminho de erro do servidor (`address.postalCode` → `endereco`). */
export function stepOfField(path: string): ProviderStep | null {
  const root = path.split('.')[0] ?? path;
  return PROVIDER_STEPS.find((step) => STEP_FIELDS[step].includes(root)) ?? null;
}

/**
 * Cadastro de prestador em 3 etapas (`/cadastro/prestador?etapa=…`, FR-014): Conta →
 * Estabelecimento → Endereço. Cada etapa valida antes de avançar; erros do servidor voltam à
 * etapa do primeiro campo com erro (US2 #9).
 */
@Component({
  selector: 'sm-register-provider-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AddressFormComponent,
    ButtonDirective,
    FieldComponent,
    FieldControlDirective,
    FormErrorSummaryComponent,
    PhoneBrDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-2xl px-4 py-10">
      <h1>{{ text.title }}</h1>
      <p class="mt-2 text-gray-700">{{ text.intro }}</p>

      <ol class="mt-6 flex flex-wrap gap-2 text-sm" [attr.aria-label]="text.stepsLabel">
        @for (step of steps; track step; let i = $index) {
          <li
            class="rounded-full border px-3 py-1"
            [class.border-brand]="step === currentStep()"
            [class.font-semibold]="step === currentStep()"
            [attr.aria-current]="step === currentStep() ? 'step' : null"
          >
            {{ i + 1 }}. {{ text.steps[step] }}
          </li>
        }
      </ol>

      <form
        class="sm-card mt-4 flex flex-col gap-4"
        [formGroup]="form"
        (ngSubmit)="next()"
        novalidate
      >
        <h2 #stepHeading tabindex="-1" class="text-lg outline-none">
          {{ text.stepOf(stepIndex() + 1, steps.length) }}: {{ text.steps[currentStep()] }}
        </h2>
        <sm-form-error-summary [messages]="summary()" />

        <!--
          As três etapas ficam no DOM (só a atual visível): recriar os campos faria o Angular
          revalidá-los e apagaria os erros do servidor da etapa para a qual voltamos.
        -->
        <div [hidden]="currentStep() !== 'conta'">
          <div class="flex flex-col gap-4">
            <sm-field [label]="fields.name">
              <input smFieldControl class="sm-input" formControlName="name" autocomplete="name" />
            </sm-field>
            <sm-field [label]="fields.email">
              <input
                smFieldControl
                class="sm-input"
                type="email"
                formControlName="email"
                autocomplete="email"
              />
            </sm-field>
            <sm-field [label]="fields.password" [hint]="fields.passwordHint">
              <input
                smFieldControl
                class="sm-input"
                type="password"
                formControlName="password"
                autocomplete="new-password"
              />
            </sm-field>
          </div>
        </div>
        <div [hidden]="currentStep() !== 'estabelecimento'">
          <div class="flex flex-col gap-4">
            <sm-field [label]="text.displayName">
              <input smFieldControl class="sm-input" formControlName="displayName" />
            </sm-field>
            <sm-field [label]="text.description" [hint]="text.descriptionHint" [optional]="true">
              <textarea
                smFieldControl
                class="sm-textarea"
                rows="4"
                formControlName="description"
              ></textarea>
            </sm-field>
            <sm-field [label]="text.category">
              <select smFieldControl class="sm-select" formControlName="category">
                <option value="" disabled>{{ text.chooseCategory }}</option>
                @for (option of categoryOptions; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </sm-field>
            <sm-field [label]="text.contactEmail" [hint]="text.contactEmailHint" [optional]="true">
              <input smFieldControl class="sm-input" type="email" formControlName="contactEmail" />
            </sm-field>
            <sm-field
              [label]="text.contactPhone"
              [hint]="fields.phoneHint"
              [patternMessage]="patterns.phone"
            >
              <input
                smFieldControl
                smPhoneBr
                class="sm-input"
                type="tel"
                formControlName="contactPhone"
              />
            </sm-field>
            <sm-field [label]="text.timeZone" [hint]="text.timeZoneHint">
              <select smFieldControl class="sm-select" formControlName="timeZoneId">
                @for (zone of timeZones; track zone.id) {
                  <option [value]="zone.id">{{ zone.label }}</option>
                }
              </select>
            </sm-field>
          </div>
        </div>
        <div [hidden]="currentStep() !== 'endereco'">
          <sm-address-form [group]="form.controls.address" />
        </div>

        <div class="flex flex-wrap justify-between gap-2">
          @if (stepIndex() > 0) {
            <button type="button" smButton="secondary" (click)="back()">{{ text.back }}</button>
          } @else {
            <span></span>
          }
          <button type="submit" smButton [loading]="submitting()">
            {{ isLastStep() ? text.submit : text.next }}
          </button>
        </div>
      </form>

      <p class="mt-6 text-sm text-gray-700">
        {{ text.hasAccount }}
        <a class="sm-link" [routerLink]="loginPath">{{ text.login }}</a>
      </p>
    </section>
  `,
})
export class RegisterProviderPageComponent {
  /** Query param `etapa` (`withComponentInputBinding`). */
  readonly etapa = input<string>();

  private readonly authApi = inject(AuthApi);
  private readonly flow = inject(AuthFlowService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly heading = viewChild.required<ElementRef<HTMLElement>>('stepHeading');

  protected readonly text = AUTH_MESSAGES.registerProvider;
  protected readonly fields = AUTH_MESSAGES.fields;
  protected readonly patterns = PATTERN_MESSAGES;
  protected readonly steps = PROVIDER_STEPS;
  protected readonly loginPath = APP_PATHS.login;
  protected readonly timeZones = TIME_ZONE_OPTIONS;
  protected readonly categoryOptions = enumOptions(
    SERVICE_CATEGORY_VALUES,
    SERVICE_CATEGORY_LABELS,
  );

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: SmValidators.name }),
    email: new FormControl('', { nonNullable: true, validators: SmValidators.email }),
    password: new FormControl('', { nonNullable: true, validators: SmValidators.password }),
    displayName: new FormControl('', { nonNullable: true, validators: SmValidators.displayName }),
    description: new FormControl('', {
      nonNullable: true,
      validators: SmValidators.providerDescription,
    }),
    category: new FormControl<ServiceCategory | ''>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    contactEmail: new FormControl('', {
      nonNullable: true,
      validators: SmValidators.optionalEmail,
    }),
    contactPhone: new FormControl('', { nonNullable: true, validators: SmValidators.phone }),
    timeZoneId: new FormControl(DEFAULT_TIME_ZONE, { nonNullable: true }),
    address: createAddressForm(),
  });

  protected readonly submitting = signal(false);
  protected readonly summary = signal<string[]>([]);
  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });
  /** Incrementa a cada troca de etapa feita pelo usuário, para mover o foco ao título. */
  private readonly stepChanges = signal(0);

  /**
   * Etapa pedida na URL, mas nunca além da primeira etapa anterior ainda inválida
   * (ex.: abrir `?etapa=endereco` direto volta à Conta).
   */
  protected readonly currentStep = computed<ProviderStep>(() => {
    this.formStatus(); // revalida quando a validade do formulário muda
    const requested = this.etapa();
    const target: ProviderStep = isOneOf(PROVIDER_STEPS, requested) ? requested : 'conta';
    for (const step of PROVIDER_STEPS) {
      if (step === target || !this.isStepValid(step)) {
        return step;
      }
    }
    return target;
  });
  protected readonly stepIndex = computed(() => PROVIDER_STEPS.indexOf(this.currentStep()));
  protected readonly isLastStep = computed(() => this.stepIndex() === PROVIDER_STEPS.length - 1);

  constructor() {
    afterRenderEffect(() => {
      if (this.stepChanges() > 0) {
        this.heading().nativeElement.focus();
      }
    });
  }

  protected next(): void {
    if (this.submitting()) {
      return;
    }
    const step = this.currentStep();
    if (!this.isStepValid(step)) {
      this.controlsOf(step).forEach((c) => c.markAllAsTouched());
      return;
    }
    this.summary.set([]);
    if (this.isLastStep()) {
      this.register();
      return;
    }
    const nextStep = PROVIDER_STEPS[this.stepIndex() + 1];
    if (nextStep) {
      this.goTo(nextStep);
    }
  }

  protected back(): void {
    const previous = PROVIDER_STEPS[this.stepIndex() - 1];
    if (previous) {
      this.summary.set([]);
      this.goTo(previous);
    }
  }

  private register(): void {
    this.submitting.set(true);
    this.authApi
      .registerProvider(this.toRequest())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (auth) => void this.flow.complete(auth, APP_PATHS.providerArea.home),
        error: (error: unknown) => {
          const result = handleAuthFormError(this.form, error);
          this.summary.set(result.summary);
          const firstStep = PROVIDER_STEPS.find((step) =>
            result.fields.some((path) => stepOfField(path) === step),
          );
          if (firstStep && firstStep !== this.currentStep()) {
            this.goTo(firstStep);
          }
        },
      });
  }

  private toRequest(): RegisterProviderRequest {
    const v = this.form.getRawValue();
    const email = v.email.trim();
    const category = isOneOf(SERVICE_CATEGORY_VALUES, v.category) ? v.category : 'Other';
    return {
      name: v.name.trim(),
      email,
      password: v.password,
      displayName: v.displayName.trim(),
      description: v.description.trim() || null,
      category,
      // Padrão: o e-mail da conta (FR-014).
      contactEmail: v.contactEmail.trim() || email,
      contactPhone: v.contactPhone,
      address: toAddress(this.form.controls.address),
      timeZoneId: v.timeZoneId,
    };
  }

  private goTo(step: ProviderStep): void {
    this.stepChanges.update((n) => n + 1);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { etapa: step },
      queryParamsHandling: 'merge',
    });
  }

  private controlsOf(step: ProviderStep): AbstractControl[] {
    return STEP_FIELDS[step]
      .map((path) => this.form.get(path))
      .filter((c): c is AbstractControl => c !== null);
  }

  private isStepValid(step: ProviderStep): boolean {
    return this.controlsOf(step).every((c) => c.valid);
  }
}
