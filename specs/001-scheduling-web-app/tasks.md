---

description: "Lista de tarefas da implementação do ScheduleManager Web"
---

# Tasks: Aplicação Web do Agendador Online (ScheduleManager Web)

**Input**: documentos de design em `specs/001-scheduling-web-app/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: **incluídos**. A constituição (Art. IV.1) exige suíte Vitest + jsdom para toda funcionalidade crítica, e o SC-005 exige os 17 cenários do briefing em E2E (Playwright) contra a API real. Em cada história, os testes vêm antes da implementação e devem falhar primeiro.

**Organization**: tarefas agrupadas por user story, para implementar e testar cada uma de forma independente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência de tarefa incompleta)
- **[Story]**: história a que a tarefa pertence (US1…US8)
- Caminhos relativos à raiz do workspace `web/` (toda a implementação em `src/`, Art. V.5 / R15)

## Regras que valem para TODAS as tarefas

- Angular 22.3, TypeScript 6.0 `strict`, **`any` proibido** (use `unknown` + type guards). Componentes com `standalone: true` explícito, `ChangeDetectionStrategy.OnPush`, signals, `@if`/`@for`, Reactive Forms tipados. Arquivos em kebab-case.
- Componentes e páginas **nunca** importam `HttpClient`: usam os serviços de `src/app/core/api/*.api.ts`. As rotas da API vêm só de `src/app/core/api/endpoints.ts`.
- Nenhum endpoint, campo ou enum fora do contrato `../api/specs/001-online-scheduling-api/contracts/openapi.yaml`. Os modelos são aliases de `schema.gen.ts`.
- Textos pt-BR em `src/app/core/i18n/*.messages.ts`; nenhuma string de interface solta nos templates além de interpolações dessas constantes. Constantes (chaves de storage, tempos, `pageSize`) em `src/app/core/config/app.constants.ts`.
- Toda tela com dados remotos usa `RemoteState<T>` (carregando / vazio / erro / sucesso, FR-004) e desabilita o envio durante a requisição (FR-005).
- Horários de agendamento sempre via `formatInZone(instant, timeZoneId do prestador)` + `zone-hint` (FR-003). O `startAt` do slot é **opaco**: repassado sem conversão (FR-026).
- Acessibilidade WCAG 2.1 AA: rótulos, `aria-describedby` nos erros, foco visível, status com ícone **e** texto (FR-009, FR-011).
- Uma tarefa só é marcada como concluída depois de rodar `npm run lint`, `npm test` e `npm run build` sem erros nem avisos (Art. IV.2).

---

## Phase 1: Setup (infraestrutura compartilhada)

**Purpose**: criar o workspace Angular 22 e as ferramentas de qualidade.

- [X] T001 Conferir que o Node é ≥ 22.22.3 (`node -v`; a máquina tem 22.20.0 e precisa atualizar para a 22 LTS mais recente) e criar o workspace Angular 22.3 **na própria pasta `web/`** (`src/` já existe vazio): `npx @angular/cli@22.3.0 new schedule-manager-web --directory . --prefix sm --style=scss --routing --ssr=false`, que **inicializa o repositório git** em `web/` (o portão de tipos usa `git diff`), com `sourceRoot: "src"` em `angular.json` e detecção **zoneless** (sem `zone.js` em `polyfills`); completar o `.gitignore` com `node_modules/`, `dist/`, `.angular/`, `test-results/` e `playwright-report/` antes do primeiro commit; remover o conteúdo de exemplo de `src/app/app.component.html`
- [X] T002 Ajustar `tsconfig.json`: `strict: true`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`; em `angularCompilerOptions`, `strictTemplates`, `strictInjectionParameters`, `strictInputAccessModifiers`; conferir `typescript` fixado em `~6.0.3` no `package.json`
- [X] T003 Instalar as dependências de runtime com versão exata em `package.json`: `@angular/cdk@22.3.0`, `@lucide/angular@1.81.0`, `jwt-decode@4.0.0` (rxjs 7.8 já vem do CLI)
- [X] T004 [P] Configurar TailwindCSS 3.4: `npm i -D tailwindcss@3.4.19 postcss autoprefixer`, criar `tailwind.config.js` (`content: ['./src/**/*.{html,ts}']`, tokens de cor dos tons de status `warning|success|danger|neutral|info` com contraste AA, fonte do sistema) e `.postcssrc.json` (o builder do Angular só lê configuração PostCSS em JSON; `postcss.config.js` seria ignorado); em `src/styles.scss`, as diretivas `@tailwind base/components/utilities`, um estilo de foco visível global (`:focus-visible` com anel de 2 px) e a classe `.sr-only`
- [X] T005 [P] Configurar o lint: `ng add angular-eslint@22` e criar `eslint.config.js` com `@typescript-eslint/no-explicit-any: error`, `@angular-eslint/prefer-on-push-component-change-detection: error`, `@angular-eslint/prefer-standalone: error` e `no-restricted-imports` proibindo `@angular/common/http` em `src/app/features/**` e `src/app/shared/**`, e proibindo `**/core/api/*.api` em `src/app/shared/**` (shared só apresentacional, Art. II.1); script `"lint": "ng lint --max-warnings 0"`
- [X] T006 [P] Configurar o Prettier: `npm i -D prettier`, criar `.prettierrc` (`singleQuote: true`, `printWidth: 100`) e `.prettierignore` (incluindo `src/app/core/api/schema.gen.ts`); scripts `"format": "prettier --write ."` e `"format:check": "prettier --check ."`
- [X] T007 [P] Criar `proxy.conf.json` mapeando `/api` → `https://localhost:7154` com `secure: false` e `changeOrigin: true` (a API não habilita CORS), e o script `"start": "ng serve --proxy-config proxy.conf.json"`
- [X] T008 [P] Criar `src/environments/environment.ts` e `src/environments/environment.development.ts` com `apiBaseUrl: '/api/v1'` e `production`, e configurar `fileReplacements` em `angular.json`
- [X] T009 Gerar os tipos do contrato: `npm i -D openapi-typescript@7.13.0`; em `package.json`, `"overrides": { "openapi-typescript": { "typescript": "$typescript" } }` e o script `"api:types": "openapi-typescript ../api/specs/001-online-scheduling-api/contracts/openapi.yaml -o src/app/core/api/schema.gen.ts"`. Rodar `npm run api:types` e **confirmar empiricamente** que gera o arquivo sem erros com o TS 6.0. Se falhar, trocar o script por `npx -p typescript@5.9 -p openapi-typescript@7.13.0 openapi-typescript …` (R5) e registrar a escolha no `research.md` R5
- [X] T010 [P] Configurar os testes unitários: `npm i -D vitest@5 jsdom`; em `angular.json`, o target `test` com builder `@angular/build:unit-test` e as opções `runner: "vitest"`, `include: ["app/**/*.spec.ts"]` (relativo a `src/`) e `setupFiles: ["src/test-setup.ts"]`. Sem `browsers`, o builder usa `jsdom` automaticamente (conferido no schema 22.3.0; **não** existe opção `environment`); **não** instalar `happy-dom`, que teria prioridade. Criar `src/test-setup.ts` com o locale pt-BR registrado; script `"test": "ng test --watch=false"`
- [X] T011 [P] Configurar o E2E: `npm i -D @playwright/test@1.65.1 @axe-core/playwright`, `npx playwright install chromium`; criar `playwright.config.ts` (`testDir: 'src/e2e'`, `testMatch: '**/*.e2e.ts'`, `baseURL: 'http://localhost:4200'`, `locale: 'pt-BR'`, `timezoneId: 'America/Sao_Paulo'`, `webServer` com `npm start` e `reuseExistingServer: true`, `workers: 1`) e `src/e2e/tsconfig.json`; script `"e2e": "playwright test"`
- [X] T012 Configurar os orçamentos de bundle em `angular.json` (produção): `initial` com `maximumWarning: 500kB` / `maximumError: 600kB` e `anyScript` 400 kB / 500 kB, em tamanho **bruto** (achado I3: o Angular não mede gzip; a meta do plano é ≤ 300 kB gzip) e `anyComponentStyle` 6 kB / 10 kB; habilitar `"budgets"` com falha por aviso no CI
- [X] T013 Rodar os portões do [quickstart §4](./quickstart.md) com o app vazio (`npm run api:types && git diff --exit-code src/app/core/api/schema.gen.ts`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`) e corrigir até ficarem todos sem erros e sem avisos

---

## Phase 2: Foundational (pré-requisitos bloqueantes)

**Purpose**: núcleo usado por todas as histórias: modelos, HTTP, erros, sessão, fusos, formulários, UI base e shell.

**⚠️ CRITICAL**: nenhuma história começa antes do fim desta fase.

### Configuração, modelos e i18n

- [X] T014 [P] Criar `src/app/core/config/app.constants.ts` com: `STORAGE_KEYS = { session: 'sm.session', bookingDraft: 'sm.booking-draft' }`, `SESSION_WARNING_MINUTES = 5`, `DEFAULT_PAGE_SIZE = 20`, `MAX_PAGE_SIZE = 100`, `CALENDAR_PAGE_SIZE = 100`, `MAX_PERIOD_DAYS = 366`, `BOOKING_MAX_DAYS_AHEAD = 365`, `NOTES_MAX = 500`, `CANCEL_REASON_MIN = 3`, `CANCEL_REASON_MAX = 500`, `DEFAULT_TIME_ZONE = 'America/Sao_Paulo'`, `RESCHEDULE_DEFAULT_REASON = 'Reagendamento solicitado pelo cliente'`, `EXCEPTION_MAX_PERIOD_DAYS = 366` (todos `as const`)
- [X] T015 [P] Criar `src/app/core/config/time-zones.ts` com a lista de fusos IANA: os brasileiros em destaque (`America/Sao_Paulo`, `America/Manaus`, `America/Belem`, `America/Fortaleza`, `America/Recife`, `America/Bahia`, `America/Cuiaba`, `America/Campo_Grande`, `America/Porto_Velho`, `America/Boa_Vista`, `America/Rio_Branco`, `America/Noronha`, `America/Araguaina`, `America/Maceio`, `America/Santarem`, `America/Eirunepe`) e os demais via `Intl.supportedValuesOf('timeZone')`, expondo `TIME_ZONE_OPTIONS: readonly { id: string; label: string; featured: boolean }[]`
- [X] T016 [P] Criar `src/app/core/models/enums.ts` com `ROLE_VALUES`, `SERVICE_CATEGORY_VALUES`, `APPOINTMENT_STATUS_VALUES`, `DAY_OF_WEEK_VALUES` (ordem Sunday→Saturday), `SCHEDULE_EXCEPTION_TYPE_VALUES`, `NOTIFICATION_TYPE_VALUES`, `NOTIFICATION_STATUS_VALUES`, cada um `[...] as const satisfies readonly components['schemas']['X'][]`, e os tipos derivados
- [X] T017 [P] Criar `src/app/core/models/labels.ts` com os mapas `Record<Enum, string>` do data-model §1: Role (Administrador, Prestador, Cliente); ServiceCategory (Beleza, Barbearia, Saúde, Odontologia, Terapia, Fitness, Bem-estar, Educação, Consultoria, Outros); AppointmentStatus (Pendente, Confirmado, Cancelado pelo cliente, Cancelado pelo prestador, Concluído); DayOfWeek (Domingo … Sábado); ScheduleExceptionType (Fechamento, Horário especial); NotificationType (Agendamento criado, Confirmado, Cancelado, Lembrete); NotificationStatus (Pendente, Enviada, Falhou, Cancelada). Também `STATUS_VISUALS: Record<AppointmentStatus, { icon: LucideIconData; tone: 'warning' | 'success' | 'danger' | 'neutral' | 'info' }>`
- [X] T018 [P] Criar `src/app/core/models/api-models.ts` com os aliases `type X = components['schemas']['X']` de todos os modelos do data-model §2 (Address, Page genérico, ProblemDetails, ValidationProblemDetails, LoginRequest, RegisterCustomerRequest, RegisterProviderRequest, AuthResponse, CurrentUser, CustomerProfile, UpdateCustomerRequest, ProviderSummary, ProviderPublicProfile, ProviderProfile, UpdateProviderRequest, BookingPolicy, Service, ServiceRequest, ActiveStatusRequest, TimeInterval, WeeklySchedule, ScheduleExceptionRequest, ScheduleException, ScheduleChangeResult, ScheduleExceptionCreated, AvailabilityResponse, TimeSlot, CreateAppointmentRequest, CancelAppointmentRequest, AppointmentSummary, Appointment, StatusChange, Notification, UserSummary) e os tipos `Uuid`, `Instant`, `LocalDate`, `LocalTime`, `PageQuery = { page?: number; pageSize?: number }`, `Versioned<T> = { value: T; etag: string }`. Se um nome não existir no `schema.gen.ts`, use o nome real do contrato e **não** crie campo
- [X] T019 [P] Criar `src/app/core/i18n/common.messages.ts` (ações genéricas, estados vazio/carregando/erro, paginação, "Tentar novamente", "Código para suporte", rótulo de fuso, cabeçalho e navegação por perfil, páginas de erro, aviso de sessão "Sua sessão expira em 5 min — salve seu trabalho", "Entrar novamente", "Sua sessão expirou. Entre novamente.")

### API base e erros

- [X] T020 [P] Criar `src/app/core/api/endpoints.ts`, a **única** fonte das 34 rotas (funções puras, ex.: `providerAvailability(providerId)`), e o array `ENDPOINT_INVENTORY: readonly { id: number; method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }[]` com os 34 pares do Apêndice A da spec
- [X] T021 [P] Escrever `src/app/core/api/http-params.spec.ts`: arrays viram parâmetros repetidos (`status=Pending&status=Confirmed`), `undefined`/`''` omitidos, booleanos `true`/`false`, números como string
- [X] T022 Implementar `src/app/core/api/http-params.ts` (`toHttpParams(query: Record<string, string | number | boolean | readonly string[] | undefined>): HttpParams`) até T021 passar
- [X] T023 [P] Escrever `src/app/core/errors/problem-details.guards.spec.ts` e `src/app/core/errors/api-error.spec.ts`: reconhece ProblemDetails e ValidationProblemDetails a partir de `unknown`; `status 0` → `kind: 'network'`; 5xx sem corpo → `kind: 'unknown'` com `traceId` do corpo ou `undefined`; `http.error` vira `kind: 'problem'`
- [X] T024 Implementar `src/app/core/errors/problem-details.guards.ts` (`isProblemDetails`, `isValidationProblemDetails`, sem `any`) e `src/app/core/errors/api-error.ts` (classe/tipo `ApiError { kind: 'problem' | 'network' | 'unknown'; status: number; problem?: ProblemDetails | ValidationProblemDetails; code?: ApiErrorCode; traceId?: string }` + `toApiError(err: HttpErrorResponse)`) até T023 passar
- [X] T025 [P] Escrever `src/app/core/errors/error-messages.spec.ts`: **todos** os 37 códigos de `API_ERROR_CODES` têm mensagem não vazia (SC-007); código desconhecido usa o `detail` da API; sem `detail`, mensagem genérica com `traceId`; `{traceId}` é interpolado
- [X] T026 Implementar `src/app/core/errors/error-messages.ts`: `API_ERROR_CODES` (os 36 códigos do briefing + `http.error`, `as const`), `ApiErrorCode`, `ERROR_MESSAGES: Record<ApiErrorCode, { message: string; presentation: 'field' | 'inline' | 'toast' | 'page'; field?: string }>` com **exatamente** as mensagens e apresentações da tabela de [contracts/error-catalog.md](./contracts/error-catalog.md), e `resolveErrorMessage(error: ApiError): string`, até T025 passar
- [X] T027 [P] Escrever `src/app/core/errors/form-errors.spec.ts`: `applyServerErrors(form, validationProblem)` põe `{ server: msg }` no controle pelo caminho pontuado (`address.city` → `form.get('address.city')`) e devolve as mensagens sem controle correspondente para o resumo; `applyFieldError(form, 'email', msg)` para os 409 de campo
- [X] T028 Implementar `src/app/core/errors/form-errors.ts` até T027 passar

### HTTP e sessão

- [X] T029 Criar `src/app/core/http/http-contexts.ts` com `SKIP_SESSION_401 = new HttpContextToken<boolean>(() => false)` e `SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false)`
- [X] T030 [P] Escrever `src/app/core/auth/session.store.spec.ts`: `start(authResponse)` grava em memória e em `sessionStorage['sm.session']`; `restore()` lê, descarta se `now ≥ expiresAt` ou se o JSON for inválido; `isExpired`, `warningAt = expiresAt − 5 min`; `clear()` apaga memória e storage; o token nunca é logado; flag `warned` é por sessão
- [X] T031 Implementar `src/app/core/auth/session.store.ts` (signals `session`, `user`, `role`, `isAuthenticated`; `start`, `restore`, `clear`, `markWarned`; usa `jwt-decode` só para checar consistência do `exp` ao restaurar, R6) até T030 passar
- [X] T032 [P] Escrever `src/app/core/auth/return-url.spec.ts`: aceita caminhos que começam com `/` e não com `//`; rejeita URLs absolutas, `javascript:`, `/entrar*` e `/cadastro*`; `homeForRole` → Customer `/cliente/agendamentos`, Provider `/prestador`, Admin `/admin/usuarios`; `isUrlAllowedForRole` (prefixos `/cliente`, `/prestador`, `/admin`, públicas para todos)
- [X] T033 Implementar `src/app/core/auth/return-url.ts` (`sanitizeReturnUrl`, `homeForRole`, `resolvePostLoginUrl(returnUrl, role)`, conforme "Redirecionamento após login" de [contracts/routes.md](./contracts/routes.md)) até T032 passar
- [X] T034 [P] Escrever `src/app/core/http/interceptors.spec.ts` com `HttpTestingController`: `apiBaseUrlInterceptor` prefixa `/api/v1` só em URLs relativas da API; `authInterceptor` adiciona `Authorization: Bearer <token>` só com sessão; `errorInterceptor` converte em `ApiError`, em `401` limpa a sessão e navega a `/entrar?returnUrl=<url atual>&motivo=sessao-expirada` (exceto com `SKIP_SESSION_401`), em `403` mostra o toast "Você não tem permissão para esta ação."
- [X] T035 Implementar `src/app/core/http/api-base-url.interceptor.ts`, `src/app/core/http/auth.interceptor.ts` e `src/app/core/http/error.interceptor.ts` (funcionais, ordem R8, sem retry automático) até T034 passar
- [X] T036 Criar `src/app/core/api/auth.api.ts` (`AuthApi`: `registerCustomer`, `registerProvider`, `login` com `SKIP_SESSION_401`, `me`; operações #1–#4 de [contracts/api-services.md](./contracts/api-services.md)) e o teste de contrato `src/app/core/api/auth.api.spec.ts` (método, URL, corpo)
- [X] T037 [P] Escrever `src/app/core/auth/session-timer.service.spec.ts` com fake timers do Vitest: aos `expiresAt − 5 min`, emite o aviso **uma vez**; em `expiresAt`, limpa a sessão e navega a `/entrar?returnUrl=…&motivo=sessao-expirada`; o aviso não renova a sessão; os timers são cancelados no `clear()`
- [X] T038 Implementar `src/app/core/auth/session-timer.service.ts` até T037 passar
- [X] T039 [P] Escrever `src/app/core/auth/guards.spec.ts`: `authGuard` sem sessão → `UrlTree` `/entrar?returnUrl=<url>`; `roleGuard('Provider')` com Customer → `/sem-permissao`; `guestGuard` com sessão → home do perfil
- [X] T040 Implementar `src/app/core/auth/auth.guard.ts`, `src/app/core/auth/role.guard.ts` e `src/app/core/auth/guest.guard.ts` (funcionais) até T039 passar
- [X] T041 Criar `src/app/core/auth/session-initializer.ts` (`provideAppInitializer`: `SessionStore.restore()` → se válida, `AuthApi.me()` atualiza `user`; em erro, `clear()` → agenda `SessionTimerService`) (FR-018)

### Tempo, estado e formulários

- [X] T042 [P] Escrever `src/app/shared/time/zoned-time.spec.ts`: `formatInZone('2026-12-01T12:30:00-04:00', 'America/Manaus')` → `01/12/2026 12:30`; o mesmo instante em `America/Sao_Paulo` → `13:30`; `zoneLabel` só quando o fuso difere do navegador; `zonedDayRange('2026-12-01', tz)` → `from`/`to` com o offset do fuso (`to` exclusivo, dia seguinte); `zonedWeekRange` de domingo a domingo; virada de dia (23:30 num fuso = dia seguinte em outro); `todayInZone`; `addDays` em `LocalDate`
- [X] T043 Implementar `src/app/shared/time/zoned-time.ts` só com `Intl.DateTimeFormat` (`formatToParts` + `timeZoneName: 'longOffset'`, R7) até T042 passar
- [X] T044 [P] Criar os pipes `src/app/shared/time/in-zone.pipe.ts` (`instant | inZone: tz : 'datetime' | 'date' | 'time'`) standalone e puro; **sem** `brl.pipe`: o `CurrencyPipe` nativo com `DEFAULT_CURRENCY_CODE = 'BRL'` já formata `R$ 50,00` (achado I4, §3.2 recursos nativos)
- [X] T045 [P] Criar `src/app/shared/state/remote-state.ts` (`RemoteState<T> = { status: 'idle' } | { status: 'loading' } | { status: 'empty' } | { status: 'ready'; value: T } | { status: 'error'; error: ApiError }` e o helper `toRemoteState(obs, isEmpty?)`)
- [X] T046 [P] Escrever `src/app/shared/state/list-query.spec.ts`: `parseListQuery(paramMap, schema)` tipado (inválido volta ao padrão, `itens` limitado a 1–100, `pagina ≥ 1`), `serializeListQuery` omite padrões, arrays repetidos (`status`)
- [X] T047 Implementar `src/app/shared/state/list-query.ts` até T046 passar
- [X] T048 [P] Escrever `src/app/shared/forms/validators.spec.ts` cobrindo exatamente: nome 2–120; e-mail válido ≤ 254; senha 8–128 com ao menos uma letra e um dígito; telefone `^\+[1-9]\d{7,14}$`; `street` ≤ 200, `number` ≤ 20, `complement` ≤ 100, `district` ≤ 100, `city` ≤ 100, `state` `^[A-Z]{2}$`, `postalCode` `^\d{8}$`; `displayName` 2–120; `description` ≤ 2000; múltiplo de 5; `LocalTime` `^([01]\d|2[0-3]):[0-5]\d$`; `start < end`; `nonOverlappingIntervals` (ordena por `start`, exige `intervals[i].end ≤ intervals[i+1].start`, faixas encostadas válidas); período `to > from` e ≤ 366 dias; período de exceção `endDate − startDate + 1 ≤ 366`
- [X] T049 Implementar `src/app/shared/forms/validators.ts` (validadores puros `ValidatorFn`) até T048 passar
- [X] T050 [P] Escrever `src/app/shared/forms/phone-br.directive.spec.ts` e `src/app/shared/forms/cep.directive.spec.ts`: `smPhoneBr` exibe `(11) 99999-8888` e grava `+5511999998888` (aceita fixo de 8 dígitos e celular de 9); `smCep` exibe `00000-000` e grava `00000000`
- [X] T051 Implementar `src/app/shared/forms/phone-br.directive.ts` e `src/app/shared/forms/cep.directive.ts` (`ControlValueAccessor`, R13) até T050 passar
- [X] T052 Criar `src/app/shared/forms/address-form.component.ts` (subformulário tipado `street`, `number`, `complement`, `district`, `city`, `state`, `postalCode` com os validadores de T049, `smCep` e select de UF), reutilizado pelo cadastro e pelo estabelecimento

### UI compartilhada (`src/app/shared/ui/`)

- [X] T053 [P] Criar a diretiva `src/app/shared/ui/button.directive.ts` (`button[smButton]`, mantém a semântica do `<button>` nativo) (variantes `primary|secondary|danger|ghost`, input `loading` que desabilita e mostra spinner com `aria-busy`, FR-005)
- [X] T054 [P] Criar `src/app/shared/ui/field.component.ts` (rótulo, dica, erro de cliente/servidor com `aria-describedby` e `aria-invalid`, conteúdo projetado) e `src/app/shared/ui/form-error-summary.component.ts` (resumo de erros sem campo, com foco ao aparecer)
- [X] T055 [P] Select nativo estilizado por `.sm-select` + `smFieldControl`, com opções tipadas em `src/app/shared/ui/select-options.ts` (`enumOptions`, `BRAZIL_STATES`)
- [X] T056 [P] Criar `src/app/core/feedback/dialog.service.ts` (singleton em `core`, Art. II.1) sobre `@angular/cdk/dialog` (foco preso, `Esc` fecha, foco devolvido) e `src/app/shared/ui/confirm-dialog.component.ts` (título, texto, ação de confirmação com tom `danger` opcional)
- [X] T057 [P] Criar `src/app/core/feedback/toast.service.ts` (singleton em `core`, Art. II.1) + `src/app/shared/ui/toast-outlet.component.ts` (fila, auto-fechar, anúncio via `LiveAnnouncer` do CDK)
- [X] T058 [P] Criar `src/app/shared/ui/status-badge.component.ts` usando `APPOINTMENT_STATUS_LABELS` + `STATUS_VISUALS` (ícone Lucide **e** texto, nunca só cor, FR-009) e o teste `src/app/shared/ui/status-badge.component.spec.ts`
- [X] T059 [P] Criar `src/app/shared/ui/tabs.component.ts` (padrão ARIA tabs com setas do teclado)
- [X] T060 [P] Criar `src/app/shared/ui/pagination.component.ts` (anterior/próxima, "Página X de Y", seletor de itens 1–100, padrão 20, FR-008; emite `pageChange`/`pageSizeChange`) e o teste `src/app/shared/ui/pagination.component.spec.ts`
- [X] T061 [P] Criar `src/app/shared/ui/empty-state.component.ts`, `src/app/shared/ui/skeleton.component.ts` e `src/app/shared/ui/error-state.component.ts` (mensagem resolvida por `resolveErrorMessage`, `traceId` quando houver, botão "Tentar novamente")
- [X] T062 [P] Criar `src/app/shared/ui/zone-hint.component.ts` (mostra `zoneLabel(tz)`, ex.: "horário de Manaus (GMT-04:00)", somente quando `tz` difere do fuso do navegador, FR-003)
- [X] T063 [P] Criar `src/app/shared/ui/remote-view.component.ts` (renderiza `RemoteState` com skeleton / empty / error / conteúdo via `ng-template`, FR-004)

### Domínio puro

- [X] T064 [P] Escrever `src/app/core/domain/appointment-actions.spec.ts` com a tabela do data-model §3: `confirm` se `Pending` ∧ role ∈ {Provider, Admin}; `cancel` se `status ∈ {Pending, Confirmed}` ∧ `now < startAt` ∧ role ∈ {Customer, Provider, Admin}; `reschedule` igual a `cancel` só para Customer; `complete` se `Confirmed` ∧ `now ≥ startAt` ∧ role ∈ {Provider, Admin}; estados finais sem ações
- [X] T065 Implementar `src/app/core/domain/appointment-actions.ts` (`availableActions(appointment, role, now): AppointmentAction[]`) até T064 passar
- [X] T066 [P] Escrever `src/app/core/domain/booking-policy-format.spec.ts` e implementar `src/app/core/domain/booking-policy-format.ts` (`formatDuration(minutes)`: `0` → "sem antecedência", `90` → "1 h 30 min", `1440` → "1 dia", `10080` → "7 dias"; e `splitMinutes`/`joinMinutes` para editar em dias/horas/minutos)

### Shell, rotas e páginas de erro

- [X] T067 Criar `src/app/app.config.ts`: `provideZonelessChangeDetection()`, `provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }))`, `provideHttpClient(withInterceptors([apiBaseUrlInterceptor, authInterceptor, errorInterceptor]))`, `registerLocaleData(localePt)`, `LOCALE_ID: 'pt-BR'`, `DEFAULT_CURRENCY_CODE: 'BRL'` e o initializer de T041
- [X] T068 Criar `src/app/app.routes.ts` com as rotas públicas (lazy por `loadComponent`/`loadChildren`) e as áreas `/cliente` (`authGuard` + `roleGuard('Customer')`), `/prestador` (`authGuard` + `roleGuard('Provider')`) e `/admin` (`authGuard` + `roleGuard('Admin')`) com arquivos de rotas vazios `src/app/features/customer/customer.routes.ts`, `src/app/features/provider/provider.routes.ts`, `src/app/features/admin/admin.routes.ts`, mais `/sem-permissao`, `/erro` e `**`, conforme [contracts/routes.md](./contracts/routes.md)
- [X] T069 [P] Criar as páginas `src/app/features/errors/not-found.page.ts` (link para a busca), `src/app/features/errors/forbidden.page.ts` ("Você não tem permissão") e `src/app/features/errors/unexpected-error.page.ts` (mostra `trace` da query) (FR-012)
- [X] T070 Criar o shell `src/app/app.component.ts` + `src/app/features/shell/app-header.component.ts`: cabeçalho com links **só do perfil atual** (Visitante: Buscar, Entrar, Cadastrar-se, "Sou prestador"; Cliente: Meus agendamentos, Notificações, Perfil; Prestador: Agenda, Serviços, Expediente, Exceções, Política, Estabelecimento, Notificações; Admin: Usuários, Notificações, Agendamentos, Minhas notificações), botão "Sair" (`SessionStore.clear()` → `/`, FR-019), `<router-outlet>`, `toast-outlet` e link "Pular para o conteúdo"; layout responsivo a partir de 360 px
- [X] T071 Criar `src/app/features/shell/session-warning.component.ts` (aviso não bloqueante em `aria-live="polite"`, "Sua sessão expira em 5 min — salve seu trabalho", botão "Entrar novamente" → `/entrar?returnUrl=<url atual>`; uma vez por sessão, FR-017a) e o teste `src/app/features/shell/session-warning.component.spec.ts`

### Infraestrutura E2E

- [X] T072 [P] Criar `src/e2e/fixtures/api-client.ts` (chamadas diretas à API `https://localhost:7154/api/v1` com `ignoreHTTPSErrors`, via `request` do Playwright) e `src/e2e/fixtures/factories.ts`: `createProvider({ timeZoneId?, autoConfirm?, policy? })` com e-mail único por execução, `createService`, `setWorkingHours` (ex.: seg–sex 09:00–12:00 e 13:00–18:00), `createCustomer`, `bookAppointment`, `loginAsAdmin` (`admin@schedulemanager.local` / `Admin12345`), `nextWeekday(dayOfWeek, tz)`, `setWorkingHoursCoveringNow(tz)` (o dia da semana atual no fuso do prestador com a faixa 00:00–23:55) e `minutesUntilMidnight(tz)`
- [X] T073 [P] Criar `src/e2e/support/a11y.ts` (`expectNoA11yViolations(page)` com `@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) e `src/e2e/support/session.ts` (login pela UI e injeção de sessão em `sessionStorage`)

**Checkpoint**: o app abre com cabeçalho de visitante, as rotas protegidas redirecionam para o login e `npm test`, `npm run lint` e `npm run build` passam.

---

## Phase 3: User Story 1 - Descobrir prestadores e consultar horários livres (Priority: P1) 🎯 MVP

**Goal**: o visitante busca prestadores (categoria, cidade, nome, ordem, página na URL), abre a página pública e vê os horários livres de um serviço numa data, no fuso do prestador.

**Independent Test**: com prestadores criados pelas fixtures, um visitante sem conta filtra, abre um prestador e vê os horários de uma data, com o fuso indicado; uma data sem expediente mostra "Sem horários nesta data".

### Testes da User Story 1 ⚠️

- [X] T074 [P] [US1] Escrever os testes de contrato `src/app/core/api/providers.api.spec.ts` (#8 `search` com `category`, `city`, `q`, `sort`, `page`, `pageSize`; #9 `getPublic`; #25 `availability` com `serviceId` e `date` `yyyy-MM-dd`) e `src/app/core/api/services.api.spec.ts` (#14 `listPublic`)
- [X] T075 [P] [US1] Escrever `src/e2e/catalog.e2e.ts`: cenário 1 (filtra "Barbearia" + cidade → abre o prestador em `America/Manaus` → escolhe serviço e data → horários no fuso do prestador com a indicação "horário de Manaus"), restauração dos filtros ao recarregar/voltar (US1 #2), cenário 6 (data sem expediente → "Sem horários nesta data", sem erro), prestador inexistente → página 404 (US1 #6), busca sem resultado → "Limpar filtros" (US1 #7), e `expectNoA11yViolations` na busca e na página do prestador

### Implementação da User Story 1

- [X] T076 [P] [US1] Criar `src/app/core/api/providers.api.ts` com `search`, `getPublic` e `availability` (#8, #9, #25), usando `endpoints.ts` e `toHttpParams`, até a parte de T074 passar
- [X] T077 [P] [US1] Criar `src/app/core/api/services.api.ts` com `listPublic(providerId, q?)` (#14, só ativos) até a parte de T074 passar
- [X] T078 [P] [US1] Criar `src/app/core/i18n/catalog.messages.ts` (títulos, filtros, "Sem horários nesta data — escolha outra data", "Este prestador ainda não oferece serviços", "Nenhum prestador encontrado", "Limpar filtros")
- [X] T079 [US1] Criar `src/app/features/catalog/provider-search.page.ts`: filtros `q`, `categoria` (enum `ServiceCategory`, rótulos pt-BR), `cidade`, `ordem` (`nome` → `displayName`, `-nome` → `-displayName`), `pagina`, `itens` lidos e gravados na URL via `list-query` (FR-022); cartões com nome, categoria, cidade e UF; `remote-view`, paginação e estado vazio com "Limpar filtros"; registrar a rota `/` em `src/app/app.routes.ts`
- [X] T080 [P] [US1] Criar `src/app/features/catalog/availability-picker.component.ts`: input `providerId`, `serviceId`, `timeZoneId`; seletor de data de `todayInZone(tz)` até `+365` dias (`BOOKING_MAX_DAYS_AHEAD`); chama `availability`; lista os slots com `formatInZone(slot.startAt, tz, 'time')` + `zone-hint`; `slots: []` → estado vazio com sugestão de outra data (FR-004); `422 availability.beyond_horizon` → "O prestador ainda não abriu a agenda para esta data. Escolha uma data mais próxima." (FR-031); `422 availability.date_in_past` → mensagem do catálogo; emite `slotSelected(slot)` com o `startAt` **intacto**
- [X] T081 [P] [US1] Escrever `src/app/features/catalog/availability-picker.component.spec.ts`: estado vazio com `slots: []`, mensagem de horizonte, horários exibidos no fuso do prestador e `slotSelected` emitindo exatamente a string recebida — *Feito com um `ProvidersApi` falso: a regra de camadas do ESLint proíbe `@angular/common/http` em `features/`, inclusive nos specs.*
- [X] T082 [US1] Criar `src/app/features/catalog/provider-profile.page.ts` (`/prestadores/:providerId`, query `servico` e `data`): mostra nome, descrição, categoria, contatos, endereço, fuso (FR-023) e a lista de serviços ativos (nome, descrição, duração, preço em BRL); "Este prestador ainda não oferece serviços" se vazio; ao escolher serviço/data, grava na URL e exibe `availability-picker`; ao escolher um horário, navega a `/prestadores/:providerId/agendar?servico=&data=&horario=<startAt codificado>`; `404 provider.not_found` → página não encontrada com link para a busca — *A rota `/prestadores/:id/agendar` só existe a partir da US3; até lá, escolher um horário cai na página 404.*

**Checkpoint**: a vitrine funciona sozinha (T075 passa).

---

## Phase 4: User Story 2 - Cadastro, login e sessão (Priority: P1)

**Goal**: cadastro de cliente e de prestador (assistente conta → estabelecimento → endereço), login com redirecionamento por perfil, sessão de 60 min com aviso aos 55 min, expiração com retorno à página e "Sair".

**Independent Test**: cadastrar um cliente e um prestador, sair, entrar de novo e verificar o redirecionamento por perfil, o aviso de 5 min e a volta à página após a sessão expirar.

### Testes da User Story 2 ⚠️

- [X] T083 [P] [US2] Escrever `src/app/features/auth/login.page.spec.ts`: `401 auth.invalid_credentials` mostra "E-mail ou senha inválidos." sem acionar o fluxo de sessão expirada; com `motivo=sessao-expirada` mostra "Sua sessão expirou. Entre novamente."; após sucesso navega para `resolvePostLoginUrl(returnUrl, role)`
- [X] T084 [P] [US2] Escrever `src/app/features/auth/register-provider.page.spec.ts`: o assistente não avança com etapa inválida; `400 validation.failed` com `errors['address.postalCode']` volta à etapa Endereço com o erro no campo CEP; `409 user.email_taken` volta à etapa Conta com o erro no e-mail
- [X] T085 [P] [US2] Escrever `src/e2e/session-and-access.e2e.ts`: cadastro de cliente → "Meus agendamentos" (US2 #1); e-mail duplicado em maiúsculas → "Este e-mail já está em uso" (US2 #3); cenário 13 com `page.clock` (aos 55 min aparece o aviso de 5 min; aos 60 min uma navegação leva a `/entrar?returnUrl=…&motivo=sessao-expirada` e, após entrar, volta à página original); recarregar a aba mantém a sessão (US2 #6); "Sair" volta à vitrine (US2 #7); cenário 14 (cliente em `/prestador/agenda` → `/sem-permissao`)
- [X] T086 [P] [US2] Escrever `src/e2e/form-validation.e2e.ts`: cenário 17, com `page.route` alterando o corpo do cadastro de prestador (`address.postalCode = "123"`) para a **API real** responder `400 validation.failed`, e o erro aparecendo no campo CEP da etapa Endereço; mais `expectNoA11yViolations` no login e nos cadastros

### Implementação da User Story 2

- [X] T087 [P] [US2] Criar `src/app/core/i18n/auth.messages.ts` (rótulos, dicas de senha, títulos das etapas Conta / Estabelecimento / Endereço, links entre login e cadastro)
- [X] T088 [US2] Criar `src/app/features/auth/login.page.ts` (`/entrar`, `guestGuard`): e-mail e senha, `AuthApi.login` → `SessionStore.start` → `SessionTimerService.schedule` → `resolvePostLoginUrl(returnUrl, role)` (FR-016); aviso "Sua sessão expirou" quando `motivo=sessao-expirada`; link "Criar conta" preservando o `returnUrl`; até T083 passar
- [X] T089 [US2] Criar `src/app/features/auth/register-customer.page.ts` (`/cadastro`, `guestGuard`): `name` 2–120, `email` ≤ 254, `password` 8–128 com ao menos uma letra e um dígito, `phone` com `smPhoneBr` (E.164); `AuthApi.registerCustomer` → sessão → `resolvePostLoginUrl`; `409 user.email_taken` no campo e-mail; `400` com `applyServerErrors` (FR-013)
- [X] T090 [US2] Criar `src/app/features/auth/register-provider.page.ts` (`/cadastro/prestador?etapa=conta|estabelecimento|endereco`, `guestGuard`): assistente de 3 etapas com validação por etapa; Conta (`name`, `email`, `password`); Estabelecimento (`displayName` 2–120, `description` ≤ 2000, `category` obrigatória, `contactEmail` opcional com padrão = e-mail da conta, `contactPhone` E.164, `timeZoneId` de `TIME_ZONE_OPTIONS`, padrão `America/Sao_Paulo`); Endereço (`address-form`); `AuthApi.registerProvider` → sessão → `/prestador`; erros do servidor voltam à etapa do primeiro campo com erro (FR-014, US2 #9); até T084 passar
- [X] T091 [US2] Registrar `/entrar`, `/cadastro` e `/cadastro/prestador` em `src/app/app.routes.ts` com `guestGuard`, e ligar o "Sair" e o `session-warning` ao shell em `src/app/app.component.ts`

**Checkpoint**: T085 e T086 passam; as áreas protegidas redirecionam corretamente.

---

## Phase 5: User Story 3 - Reservar um horário (Priority: P1)

**Goal**: escolher serviço, data e horário → resumo → confirmar com `Idempotency-Key` estável → sucesso dizendo se ficou Pendente ou Confirmado; visitante passa pelo login e volta ao resumo.

**Independent Test**: com prestador configurado pelas fixtures, um cliente reserva, vê o status resultante e o horário some da disponibilidade; duplo clique gera um único agendamento.

### Testes da User Story 3 ⚠️

- [X] T092 [P] [US3] Escrever o teste de contrato `src/app/core/api/appointments.api.spec.ts` para #26 `create`: header `Idempotency-Key`, corpo `{ providerId, serviceId, startAt, notes? }` com `startAt` igual ao do slot, `201` → `replayed: false`, `200` → `replayed: true`
- [X] T093 [P] [US3] Escrever `src/app/features/booking/booking.store.spec.ts`: a chave nasce ao abrir o resumo; reenvio reutiliza a chave; ela só muda quando `providerId`/`serviceId`/`startAt`/`notes` mudam; `200` é sucesso; `409 appointment.slot_unavailable` dispara a recarga dos horários; `409 appointment.customer_overlap` não recarrega; `422 idempotency.key_reused` gera nova chave; `422 availability.*`, `service.inactive` e `provider.inactive` voltam à escolha de horário com a mensagem do catálogo; o rascunho de `notes` fica em `sessionStorage['sm.booking-draft']`
- [X] T094 [P] [US3] Escrever `src/app/features/booking/booking.page.spec.ts`: o resumo mostra prestador, serviço, duração, preço, data/hora no fuso do prestador e observações; `notes` > 500 bloqueia o envio e mostra o limite (US3 #8); visitante em "Confirmar" é levado a `/entrar?returnUrl=<url da reserva>`; o botão fica desabilitado durante o envio
- [X] T095 [P] [US3] Escrever `src/e2e/booking.e2e.ts`: cenário 2 (visitante → "Reservar" → cadastro → volta ao resumo com as mesmas escolhas → confirma); cenário 3 (prestador sem auto-confirmação → **Pendente**; com `autoConfirm` → **Confirmado**; ao recarregar a data, o horário e os sobrepostos sumiram); cenário 4 (duplo clique em "Confirmar" e reenvio após `page.route` abortar a primeira resposta → exatamente **um** agendamento, conferido pela API); cenário 5 (outro cliente reserva o mesmo horário pela API antes da confirmação → "Este horário acabou de ser ocupado. Escolha outro." e lista recarregada); `expectNoA11yViolations` no resumo, inclusive em viewport de 360 px

### Implementação da User Story 3

- [X] T096 [P] [US3] Criar `src/app/core/api/appointments.api.ts` com `create(body, idempotencyKey): Observable<{ appointment: Appointment; replayed: boolean }>` (#26, `observe: 'response'`) até a parte de T092 passar
- [X] T097 [P] [US3] Criar `src/app/core/i18n/booking.messages.ts` (passos, resumo, "Aguardando confirmação do prestador", "Agendamento confirmado", "Ver agendamento", aviso de login para reservar)
- [X] T098 [US3] Implementar `src/app/features/booking/booking.store.ts` (`BookingAttempt` do data-model §4: `providerId`, `serviceId`, `date`, `startAt`, `notes`, `idempotencyKey` via `crypto.randomUUID()`; estados `choosing | reviewing | submitting | success | error`; tratamento de erros conforme FR-030 e [error-catalog](./contracts/error-catalog.md)) até T093 passar
- [X] T099 [P] [US3] Criar `src/app/features/booking/booking-summary.component.ts` (prestador, serviço, duração, preço BRL, data/hora com `inZone` + `zone-hint`, `textarea` de observações com contador e máximo 500, FR-025)
- [X] T100 [P] [US3] Criar `src/app/features/booking/booking-success.component.ts` (deixa claro **Pendente — aguardando confirmação do prestador** ou **Confirmado**, com `status-badge` e link para o detalhe na área do cliente, FR-029) — nota: o link "Ver agendamento" aponta para `/cliente/agendamentos/:id`, rota criada na US6 (até lá cai no "não encontrado" da área)
- [X] T101 [US3] Criar `src/app/features/booking/booking.page.ts` (`/prestadores/:providerId/agendar?servico=&data=&horario=`): carrega `getPublic` + `listPublic`; sem `horario`, mostra `availability-picker`; com `horario`, mostra o resumo; "Confirmar" sem sessão de Customer → `/entrar?returnUrl=<url atual>` (FR-028); com sessão de outro perfil → mensagem de que só clientes reservam; em `slot_unavailable`, remove `horario` da URL e recarrega os horários; registrar a rota em `src/app/app.routes.ts`; até T094 passar

**Checkpoint**: T095 passa; o fluxo principal do cliente está pronto.

---

## Phase 6: User Story 4 - Configuração do prestador (Priority: P1)

**Goal**: checklist de primeiros passos, serviços, expediente semanal, exceções, política de reservas e estabelecimento, com o painel de agendamentos afetados.

**Independent Test**: um prestador novo cria um serviço, um expediente com almoço e revisa a política; o checklist some e a página pública passa a mostrar horários sem o intervalo de almoço.

### Testes da User Story 4 ⚠️

- [X] T102 [P] [US4] Escrever os testes de contrato: `src/app/core/api/providers.api.spec.ts` (acrescentar #10 `getMe`, #11 `updateMe`, #12 `updateBookingPolicy`), `src/app/core/api/services.api.spec.ts` (acrescentar #15 `listMine` com `isActive`, #16 `create`, #17 `update`, #18 `delete`, #19 `setStatus` com `{ isActive }`), `src/app/core/api/schedule.api.spec.ts` (#20–#24; `replaceWorkingHours` **não** envia `timeZoneId`) e `src/app/core/api/appointments.api.spec.ts` (acrescentar #27 `get` com `etag = ETag ?? W/"{version}"` e #29 `cancel` com `If-Match`)
- [X] T103 [P] [US4] Escrever `src/app/features/provider/setup/provider-setup.store.spec.ts`: concluído = ≥ 1 serviço ativo (`listMine({ isActive: true, pageSize: 1 }).totalCount ≥ 1`) **e** ≥ 1 dia com expediente (`days.length ≥ 1`); "Revisar política" não bloqueia; reaparece se todos os serviços forem desativados
- [X] T104 [P] [US4] Escrever `src/app/features/provider/schedule/schedule-editor.component.spec.ts`: faixas sobrepostas (09:00–12:00 e 11:00–14:00) ou início ≥ fim marcam o erro **na própria faixa** e **nenhuma** requisição é feita; até 10 faixas por dia; dia sem faixas = fechado e omitido do corpo; o `PUT` envia só `days`
- [X] T105 [P] [US4] Escrever `src/e2e/provider-setup.e2e.ts`: cenário 8 (cadastro de prestador → checklist → serviço "Corte" 30 min R$ 50,00 → expediente seg–sex 09:00–12:00 e 13:00–18:00 → o checklist some; na página pública, nenhum horário entre 12:00 e 13:00 numa segunda); cenário 9 (11:00–14:00 numa segunda → erro na faixa e nenhuma requisição `PUT`, verificado com `page.on('request')`); cenário 10 (agendamento criado pela fixture → exceção de fechamento cobrindo a data → o painel lista o agendamento afetado); exclusão de serviço agendado → oferece desativar (US4 #7); `expectNoA11yViolations` no editor de expediente

### Implementação da User Story 4

- [X] T106 [P] [US4] Acrescentar a `src/app/core/api/providers.api.ts` os métodos `getMe`, `updateMe(body: UpdateProviderRequest)` e `updateBookingPolicy(body: BookingPolicy)` (#10–#12)
- [X] T107 [P] [US4] Acrescentar a `src/app/core/api/services.api.ts` os métodos `listMine`, `create`, `update`, `delete` e `setStatus` (#15–#19)
- [X] T108 [P] [US4] Criar `src/app/core/api/schedule.api.ts` com `getWeekly`, `replaceWorkingHours(body: Pick<WeeklySchedule, 'days'>)`, `listExceptions(q: PageQuery & { from?: LocalDate; to?: LocalDate })`, `createException` e `deleteException` (#20–#24)
- [X] T109 [P] [US4] Acrescentar a `src/app/core/api/appointments.api.ts` os métodos `get(id): Observable<Versioned<Appointment>>` (#27) e `cancel(id, etag, body: CancelAppointmentRequest)` (#29, header `If-Match`; `onBehalfOf` só no tipo `AdminCancelRequest`), até T102 passar
- [X] T110 [P] [US4] Criar `src/app/core/i18n/provider.messages.ts` (checklist, serviços, expediente, exceções, política com o aviso "As mudanças valem apenas para novas reservas", estabelecimento, "Agendamentos existentes mantêm duração e preço do momento da reserva", painel de afetados)
- [X] T111 [US4] Criar `src/app/features/appointments/cancel-dialog.component.ts` (diálogo CDK com motivo obrigatório 3–500 caracteres, contador, envio desabilitado durante a requisição; input `requireOnBehalfOf` para o Admin com opções "Em nome do cliente" / "Em nome do prestador"; aviso opcional fixo para o cliente), reutilizado por US4, US5, US6 e US8
- [X] T112 [US4] Criar o painel de afetados em duas partes (Art. II.1): `src/app/shared/ui/affected-appointments-list.component.ts`, **só apresentação**, que recebe `AppointmentSummary[]` e o `timeZoneId`, lista cliente, serviço, data/hora no fuso e status, e emite `open(id)` e `cancel(id)`; e `src/app/features/provider/affected-appointments-panel.component.ts`, que usa a lista e executa as ações "Abrir" (`/prestador/agendamentos/:id`) e "Cancelar" (`AppointmentsApi.get` → `cancel-dialog` → `cancel(etag, motivo)` → remove da lista), explicando que os agendamentos **não** foram cancelados automaticamente (FR-043) — nota: "Abrir" leva a `/prestador/agendamentos/:id`, rota criada na US5 (até lá cai no "não encontrado" da área)
- [X] T113 [US4] Implementar `src/app/features/provider/setup/provider-setup.store.ts` (`SetupChecklist`: `hasActiveService`, `hasWorkingHours`, `policyReviewedHint` só visual) até T103 passar, e `src/app/features/provider/setup/setup-checklist.page.ts` (`/prestador/primeiros-passos`: etapas "Cadastrar serviço" → "Definir expediente" → "Revisar política (opcional)" com progresso e links; quando concluído, leva à agenda) (FR-037)
- [X] T114 [US4] Criar `src/app/core/auth/provider-home.guard.ts` (`/prestador` → `/prestador/primeiros-passos` se o checklist estiver incompleto, senão `/prestador/agenda`) e registrar em `src/app/features/provider/provider.routes.ts` as rotas `primeiros-passos`, `servicos`, `expediente`, `excecoes`, `politica`, `estabelecimento` (lazy) e um placeholder de `agenda` até a US5 — nota: para caber no orçamento `anyScript` (400 kB) com o diálogo do CDK, o `ToastService` passou a carregar o `LiveAnnouncer` sob demanda
- [X] T115 [US4] Criar `src/app/features/provider/services/services.page.ts` (`/prestador/servicos?ativos=todos|sim|nao&pagina=`): lista com inativos e filtro; ações editar, ativar/desativar (`setStatus`) e excluir (com confirmação; `409 service.in_use` → diálogo "Este serviço já foi agendado e não pode ser excluído. Você pode desativá-lo." com a ação "Desativar") (FR-040)
- [X] T116 [US4] Criar `src/app/features/provider/services/service-form-dialog.component.ts`: `name` 2–100 (`409 service.name_taken` → campo `name`), `description` ≤ 1000, `durationMinutes` 5–720 em múltiplos de 5, `price` 0–99999.99 com 2 casas (entrada BRL `0,00`); na edição, aviso de que agendamentos existentes mantêm os valores do momento da reserva (US4 #9)
- [X] T117 [US4] Implementar `src/app/features/provider/schedule/schedule-editor.component.ts` e `src/app/features/provider/schedule/schedule.page.ts` (`/prestador/expediente`): Domingo → Sábado, 1–10 faixas por dia (`start`/`end` `HH:mm`), adicionar/remover faixa, validação local `start < end`, sem atravessar meia-noite e `nonOverlappingIntervals` com erro na faixa; mostra o `timeZoneId` só leitura; salvar → `replaceWorkingHours({ days })` → `affected-appointments-panel` com `affectedAppointments`; `422 schedule.invalid_working_hours` na faixa (FR-041, FR-043); até T104 passar
- [X] T118 [US4] Criar `src/app/features/provider/exceptions/exceptions.page.ts` (`/prestador/excecoes?de=&ate=&pagina=`: lista paginada por período com tipo, datas, horários e motivo; remover com confirmação; `404 schedule.exception_not_found` → toast e recarga) e `src/app/features/provider/exceptions/exception-form-dialog.component.ts`: `type` (Closure | SpecialHours), `startDate`, `endDate` (≥ `startDate`; período ≤ 366 dias, inclusive as duas pontas), `startTime?`/`endTime?` (ambos ou nenhum; obrigatórios para `SpecialHours`; `startTime < endTime`), `reason?` ≤ 200, `startDate ≥ hoje` no fuso do prestador; erros `422 schedule.exception_in_past` no `startDate` e `422 schedule.special_hours_overlap` inline; sucesso → painel de afetados (FR-042, FR-043)
- [X] T119 [US4] Criar `src/app/features/provider/booking-policy/booking-policy.page.ts` (`/prestador/politica`): lê `getMe().bookingPolicy`; `autoConfirm` ("Confirmar reservas automaticamente"); `slotStepMinutes` 5–60, múltiplo de 5; `bufferMinutes` 0–120, múltiplo de 5; `minBookingNoticeMinutes` 0–10080 e `minCancellationNoticeMinutes` 0–10080 editados em dias/horas/minutos com `formatDuration`; `bookingHorizonDays` 1–365; envia todos os campos no `PUT`; aviso fixo de que vale só para novas reservas (FR-039)
- [X] T120 [US4] Criar `src/app/features/provider/establishment/establishment.page.ts` (`/prestador/estabelecimento`): `displayName` 2–120, `description` ≤ 2000, `category`, `contactEmail` (obrigatório aqui), `contactPhone` E.164 com `smPhoneBr`, `address-form`, `timeZoneId` de `TIME_ZONE_OPTIONS`; `updateMe`; link "Ver minha página pública" → `/prestadores/{CurrentUser.providerId}` (FR-038)

**Checkpoint**: T105 passa; um prestador novo fica pronto para receber reservas.

---

## Phase 7: User Story 5 - Gestão da agenda pelo prestador (Priority: P2)

**Goal**: agenda em lista e calendário dia/semana com pendentes destacados; detalhe com contatos do cliente e linha do tempo; confirmar, cancelar e concluir com If-Match.

**Independent Test**: com agendamentos criados pelas fixtures, o prestador confirma um pendente, cancela outro, vê "concluir" indisponível antes do início e trata o conflito entre duas abas.

### Testes da User Story 5 ⚠️

- [ ] T121 [P] [US5] Acrescentar a `src/app/core/api/appointments.api.spec.ts` os testes de #28 `confirm` e #30 `complete` (header `If-Match`, novo `etag` na resposta), e a `src/app/core/api/providers.api.spec.ts` os de #13 `listMyAppointments` (`status` repetido, `from`/`to` com offset, `serviceId`, `sort`) e do helper `listAllMyAppointmentsInRange` (segue `totalPages` com `pageSize=100`)
- [ ] T122 [P] [US5] Escrever `src/app/features/appointments/appointment-detail.store.spec.ts`: `load` guarda `appointment` + `etag`; cada ação envia o `etag` exibido e guarda o novo; `412 appointment.precondition_failed` e `409 appointment.concurrency_conflict` mostram "Este agendamento foi alterado por outra pessoa. Veja o status atual." e chamam `reload()`; `422 appointment.invalid_transition` e `appointment.already_started` recarregam; `422 appointment.not_started` mostra a mensagem sem recarregar
- [ ] T123 [P] [US5] Escrever `src/app/features/provider/agenda/agenda-week.component.spec.ts`: agendamentos posicionados pelo horário no fuso do prestador (inclusive perto da meia-noite); `Pending` destacado com ícone e texto "Pendente", não só cor
- [ ] T124 [P] [US5] Escrever `src/e2e/provider-agenda.e2e.ts`: cenário 11 (confirma um Pendente → **Confirmado** com entrada na linha do tempo; "Concluir" indisponível antes do início; a fixture usa `setWorkingHoursCoveringNow`, `slotStepMinutes = 5` e `minBookingNoticeMinutes = 0`, reserva o próximo slot disponível de hoje e o teste aguarda até `startAt` (≤ 5 min, marcado com `test.slow()`) para concluir → **Concluído**; `test.skip(minutesUntilMidnight(tz) < 15, 'janela insuficiente antes da meia-noite')`); cenário 12 (duas abas do mesmo agendamento; cancela na primeira; confirma na segunda → aviso "alterado por outra pessoa" e status atualizado)

### Implementação da User Story 5

- [ ] T125 [P] [US5] Acrescentar a `src/app/core/api/providers.api.ts` `listMyAppointments(q: AppointmentListQuery & { serviceId?: Uuid })` (#13) e o helper `listAllMyAppointmentsInRange(from, to, filters)` (R16)
- [ ] T126 [P] [US5] Acrescentar a `src/app/core/api/appointments.api.ts` `confirm(id, etag)` (#28) e `complete(id, etag)` (#30), até T121 passar
- [ ] T127 [P] [US5] Criar `src/app/core/i18n/appointments.messages.ts` (rótulos do detalhe, ações Confirmar / Cancelar / Concluir / Reagendar, linha do tempo "de → para, por, motivo, quando", aviso "Cancelamentos estão sujeitos à antecedência mínima definida pelo prestador")
- [ ] T128 [US5] Implementar `src/app/features/appointments/appointment-detail.store.ts` (`AppointmentDetailState`: `appointment`, `etag`, `status: 'loading' | 'ready' | 'error'`, `pendingAction?`; `actions = computed(() => availableActions(appointment, role, now))`) até T122 passar
- [ ] T129 [P] [US5] Criar `src/app/features/appointments/history-timeline.component.ts` (lista ordenada de `StatusChange`: `fromStatus` → `toStatus`, `changedByRole` com rótulo pt-BR, `reason`, `changedAt` no fuso do prestador)
- [ ] T130 [US5] Criar `src/app/features/appointments/appointment-detail.page.ts`, compartilhada pelas 3 áreas: prestador, cliente (com e-mail e telefone quando presentes, FR-045), serviço do momento da reserva (nome, duração, preço), data/hora no fuso + `zone-hint`, `status-badge`, `notes`, `cancellationReason`, `history-timeline`; botões só das ações de `availableActions`; "Cancelar" abre o `cancel-dialog`; desabilita durante a ação; `404 appointment.not_found` → "Agendamento não encontrado."
- [ ] T131 [P] [US5] Criar `src/app/features/provider/agenda/agenda-list.component.ts` (lista paginada com `status-badge`, data/hora no fuso, cliente, serviço, link para o detalhe)
- [ ] T132 [P] [US5] Criar `src/app/features/provider/agenda/agenda-day.component.ts` e `src/app/features/provider/agenda/agenda-week.component.ts` (grade por hora no fuso do prestador, montada a partir de `zonedDayRange`/`zonedWeekRange`, pendentes destacados com ícone e texto; navegação anterior/hoje/próximo, acessível por teclado) até T123 passar
- [ ] T133 [US5] Criar `src/app/features/provider/agenda/agenda.page.ts` (`/prestador/agenda?visao=lista|dia|semana&data=&status=&servico=&pagina=`): abas de visão, filtros por status (múltiplo), serviço (de `listMine`) e período (máximo 366 dias, `to > from`, erro no próprio filtro); lista usa paginação normal; dia/semana usam `listAllMyAppointmentsInRange`; estado vazio; substituir o placeholder em `src/app/features/provider/provider.routes.ts` e registrar `agendamentos/:id` → `appointment-detail.page` (FR-044, FR-045)

**Checkpoint**: T124 passa.

---

## Phase 8: User Story 6 - Área do cliente (Priority: P2)

**Goal**: "Próximos" e "Histórico", detalhe com cancelamento sujeito à janela mínima, "Reagendar" (novo horário primeiro, depois cancelar e reservar) e perfil.

**Independent Test**: um cliente com reservas cancela uma com antecedência suficiente, tenta cancelar outra dentro da janela mínima (recusa explicada, nada muda), reagenda e edita o perfil.

### Testes da User Story 6 ⚠️

- [ ] T134 [P] [US6] Escrever o teste de contrato `src/app/core/api/customers.api.spec.ts` (#5 `getMe`, #6 `updateMe`, #7 `listMyAppointments` com `status` repetido, `from`/`to` com offset, `providerId`, `sort`)
- [ ] T135 [P] [US6] Acrescentar a `src/app/features/booking/booking.store.spec.ts` o fluxo de reagendamento (FR-035/035a): carrega o original + `etag`; motivo pré-preenchido "Reagendamento solicitado pelo cliente" (3–500, editável); confirmação faz `cancel` **e só depois** `create`; cancelamento recusado (`422 appointment.cancellation_window`) → estado `cancelRejected`, sem `create`; `create` falha após o cancelamento → estado `bookingFailedAfterCancel` com aviso de que o anterior já foi cancelado e volta à escolha de horários
- [ ] T136 [P] [US6] Escrever `src/app/features/customer/my-appointments.page.spec.ts`: "Próximos" consulta `from=agora` com offset e `sort=startAt`, sem filtro de status por padrão (cancelados futuros aparecem com o selo); "Histórico" consulta `to=agora`, `sort=-startAt`; a aba fica na URL (`aba=proximos|historico`)
- [ ] T137 [P] [US6] Escrever `src/e2e/customer-appointments.e2e.ts`: cenário 7 (com antecedência suficiente, cancela com motivo → **Cancelado pelo cliente**; dentro da janela mínima, "Cancelar" está visível com o aviso fixo, e a tentativa mostra a política do prestador e mantém o agendamento); reagendar com sucesso (o original vira "Cancelado pelo cliente" e o novo é criado); perfil com e-mail duplicado → erro no campo (US6 #6); `expectNoA11yViolations` no diálogo de cancelamento. Dados do cenário 7: prestador com `minCancellationNoticeMinutes = 120` e `setWorkingHoursCoveringNow`, um agendamento para daqui a 3 dias (cancelável) e outro no próximo slot de hoje (dentro da janela), com o mesmo `test.skip` perto da meia-noite

### Implementação da User Story 6

- [ ] T138 [P] [US6] Criar `src/app/core/api/customers.api.ts` (#5–#7) até T134 passar
- [ ] T139 [P] [US6] Criar `src/app/core/i18n/customer.messages.ts` (abas, filtros, perfil, textos do reagendamento: "Horário atual", "Novo horário", "Ao confirmar, o horário atual será cancelado primeiro e só então o novo será reservado.", "Seu agendamento anterior já foi cancelado. Escolha outro horário para concluir o reagendamento.")
- [ ] T140 [US6] Estender `src/app/features/booking/booking.store.ts` com o `RescheduleFlow` (`original`, `originalEtag`, `reason`; etapas `cancelling → booking → done` | `cancelRejected` | `bookingFailedAfterCancel`) até T135 passar
- [ ] T141 [US6] Estender `src/app/features/booking/booking.page.ts` e `src/app/features/booking/booking-summary.component.ts` com o modo `?reagendar=<appointmentId>`: mesmo prestador e serviço do original; o resumo mostra o horário atual e o novo, o aviso explícito de ordem e o campo de motivo; trata `cancelRejected` (interrompe e explica) e `bookingFailedAfterCancel` (mantém a escolha de horários aberta)
- [ ] T142 [US6] Criar `src/app/features/customer/my-appointments.page.ts` (`/cliente/agendamentos?aba=&status=&de=&ate=&prestador=&pagina=`): abas "Próximos" (início ≥ agora) / "Histórico" (início < agora), ambas com qualquer estado (`tabs`); filtros de status e período (máximo 366 dias); filtro de prestador só via `?prestador=<id>`, exibido como rótulo removível com o nome (de `provider-time-zone.cache`, que também guarda o `displayName`) e acionado pelo link "Ver todos com este prestador" em cada item (lacuna 10 da spec); lista paginada com `status-badge` e data/hora **no fuso de cada prestador**. O `AppointmentSummary` não traz `timeZoneId` (lacuna 9 da spec, R18), então use `src/app/core/api/provider-time-zone.cache.ts` (singleton, Art. II.1; guarda `timeZoneId` e `displayName`): para cada `providerId` distinto da página, `ProvidersApi.getPublic` (público) uma única vez, com cache em memória por sessão. Se a resposta for `404` (prestador desativado), exiba no fuso do navegador com o rótulo explícito "no seu fuso". Estado vazio; até T136 passar (FR-032)
- [ ] T143 [US6] Adaptar `src/app/features/appointments/appointment-detail.page.ts` para o Customer: aviso fixo "Cancelamentos estão sujeitos à antecedência mínima definida pelo prestador" junto ao "Cancelar"; `422 appointment.cancellation_window` → mensagem do catálogo com os contatos do prestador, sem alterar o agendamento; botão "Reagendar" → `/prestadores/:providerId/agendar?servico=<service.id>&reagendar=<id>`; link "Ver todos com este prestador" → `/cliente/agendamentos?prestador=<provider.id>` (FR-034, FR-035, FR-032)
- [ ] T144 [US6] Criar `src/app/features/customer/customer-profile.page.ts` (`/cliente/perfil`): `name` 2–120, `email` ≤ 254, `phone` E.164 com `smPhoneBr`; `409 user.email_taken` no campo e-mail; atualiza o nome exibido no cabeçalho (FR-036)
- [ ] T145 [US6] Registrar em `src/app/features/customer/customer.routes.ts`: `''` → `agendamentos`, `agendamentos`, `agendamentos/:id` (→ `appointment-detail.page`) e `perfil`

**Checkpoint**: T137 passa.

---

## Phase 9: User Story 7 - Caixa de notificações (Priority: P3)

**Goal**: caixa de entrada paginada, filtrável por tipo, com link para o agendamento, para os 3 perfis.

**Independent Test**: após criar e confirmar uma reserva, cliente e prestador veem as notificações e abrem o agendamento por elas.

### Testes da User Story 7 ⚠️

- [ ] T146 [P] [US7] Escrever o teste de contrato `src/app/core/api/notifications.api.spec.ts` (#31 `listMine` com `type`, `page`, `pageSize`) e `src/app/features/notifications/notifications.page.spec.ts`: filtro `tipo` na URL; o link aponta para `/cliente/agendamentos/:id`, `/prestador/agendamentos/:id` ou `/admin/agendamentos/:id` conforme o perfil; estado vazio

### Implementação da User Story 7

- [ ] T147 [P] [US7] Criar `src/app/core/api/notifications.api.ts` (#31) até a parte de T146 passar
- [ ] T148 [P] [US7] Criar `src/app/core/i18n/notifications.messages.ts` (títulos, filtro por tipo, "Sem notificações", rótulos de situação, tentativas, agendada para, enviada em)
- [ ] T149 [US7] Criar `src/app/features/notifications/notifications.page.ts` (`?tipo=&pagina=`): lista da mais recente para a mais antiga com assunto, conteúdo (texto puro, **sem** `innerHTML`), tipo, situação, tentativas, `scheduledFor`, `sentAt`, `createdAt` e o link para o agendamento por perfil (FR-049); até T146 passar
- [ ] T150 [US7] Registrar a página em `src/app/features/customer/customer.routes.ts` (`notificacoes`), `src/app/features/provider/provider.routes.ts` (`notificacoes`) e `src/app/features/admin/admin.routes.ts` (`minhas-notificacoes`), e conferir os links no `app-header`
- [ ] T151 [US7] Acrescentar a `src/e2e/booking.e2e.ts` uma verificação de US7: após a reserva e a confirmação pela API, o cliente vê "Agendamento criado" e "Confirmado" na caixa e abre o detalhe pelo link

**Checkpoint**: notificações visíveis nas 3 áreas.

---

## Phase 10: User Story 8 - Administração (Priority: P3)

**Goal**: usuários (filtros, ativar/desativar com confirmação), auditoria de notificações, busca de agendamento por ID e ações com `onBehalfOf` no cancelamento.

**Independent Test**: o Admin desativa um prestador (ele some da busca pública), vê a própria linha sem a ação de desativar e cancela, pela auditoria, um agendamento em nome do cliente.

### Testes da User Story 8 ⚠️

- [ ] T152 [P] [US8] Escrever o teste de contrato `src/app/core/api/admin.api.spec.ts` (#32 `listUsers` com `role`, `isActive`, `q`; #33 `setUserStatus` com `{ isActive }` → `204`; #34 `listNotifications` com `status`, `appointmentId`) e acrescentar a `src/app/core/api/appointments.api.spec.ts` que `onBehalfOf` só vai no corpo quando o método recebe `AdminCancelRequest`
- [ ] T153 [P] [US8] Escrever `src/e2e/admin.e2e.ts`: cenário 15 (desativa um prestador com confirmação que explica as consequências → aparece inativo e some da busca pública; a linha do próprio Admin tem a ação indisponível com explicação); cenário 16 (em `/admin/notificacoes`, abre o agendamento de uma notificação → cancela escolhendo "Em nome do cliente" e informando motivo → **Cancelado pelo cliente**); busca por ID inexistente → "Agendamento não encontrado." (US8 #6)

### Implementação da User Story 8

- [ ] T154 [P] [US8] Criar `src/app/core/api/admin.api.ts` (#32–#34) até a parte de T152 passar
- [ ] T155 [P] [US8] Criar `src/app/core/i18n/admin.messages.ts` (usuários, filtros, textos de confirmação: "O prestador deixará de aparecer no catálogo e não aceitará novas reservas.", "Você não pode desativar a sua própria conta.", auditoria, busca por ID)
- [ ] T156 [US8] Criar `src/app/features/admin/users.page.ts` (`/admin/usuarios?q=&perfil=&ativo=&pagina=`): tabela com nome, e-mail, perfil, situação e criação; ativar/desativar com `confirm-dialog` que explica as consequências por perfil; na linha do próprio Admin (`user.id === CurrentUser.id`), ação desabilitada com explicação; `422 admin.cannot_deactivate_self` inline (FR-050, FR-051)
- [ ] T157 [US8] Criar `src/app/features/admin/notifications-audit.page.ts` (`/admin/notificacoes?status=&agendamento=&pagina=`): filtros por situação (Pendente, Enviada, Falhou, Cancelada) e agendamento; tabela com tipo, assunto, situação, tentativas, agendada para, enviada em e link para `/admin/agendamentos/:appointmentId` (FR-052)
- [ ] T158 [US8] Criar `src/app/features/admin/appointment-lookup.page.ts` (`/admin/agendamentos?id=`): campo de ID (UUID válido) → navega ao detalhe; `404` → "Agendamento não encontrado." (FR-053)
- [ ] T159 [US8] Adaptar `src/app/features/appointments/appointment-detail.page.ts` para o Admin: ações confirmar, concluir e cancelar conforme `availableActions`; o `cancel-dialog` com `requireOnBehalfOf` obriga escolher "Em nome do cliente" (`Customer`) ou "Em nome do prestador" (`Provider`) e envia `onBehalfOf` (FR-053)
- [ ] T160 [US8] Registrar em `src/app/features/admin/admin.routes.ts`: `''` → `usuarios`, `usuarios`, `notificacoes`, `agendamentos`, `agendamentos/:id` (→ `appointment-detail.page`); não criar listagem geral de agendamentos nem criação de Admin (FR-054)

**Checkpoint**: T153 passa; todas as histórias funcionam.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: garantias transversais (contrato, erros, acessibilidade, desempenho) e a validação final.

- [ ] T161 [P] Escrever `src/app/core/api/endpoint-inventory.spec.ts`: os 34 itens de `ENDPOINT_INVENTORY` são todos chamados por algum método de `*.api.ts` (com `HttpTestingController`, um caso por operação), e nenhum serviço usa rota fora do inventário (SC-006)
- [ ] T162 [P] Escrever `src/app/core/errors/error-catalog-coverage.spec.ts`: a lista de códigos em `error-messages.ts` é igual à tabela de [contracts/error-catalog.md](./contracts/error-catalog.md), e nenhuma mensagem contém texto em inglês, como "error" ou "failed" (SC-007)
- [ ] T163 [P] Acrescentar `expectNoA11yViolations` nas telas críticas que ainda não têm (busca, página do prestador, reserva, diálogo de cancelamento, editor de expediente), num único `src/e2e/a11y.e2e.ts` com viewport de 360 px e de desktop (SC-009)
- [ ] T164 [P] Revisar paginação além do fim em todas as listas (`pagina` > `totalPages` → redireciona para a última página válida ou mostra estado vazio com volta à primeira), em `src/app/shared/state/list-query.ts` e nas páginas de lista
- [ ] T165 [P] Conferir que nenhum token aparece em URL, `console` ou mensagens de erro (`grep` por `accessToken` fora de `session.store.ts` e `auth.interceptor.ts`) e que não há `innerHTML` com dados da API (FR-021)
- [ ] T166 Rodar `npm run build` de produção e ajustar os orçamentos: inicial ≤ 300 kB gzip e cada área lazy ≤ 150 kB gzip, **sem avisos**; conferir que `@angular/cdk` e os ícones Lucide são importados de forma granular (tree-shaking)
- [ ] T167 Rodar todos os portões do [quickstart §4](./quickstart.md) (`api:types` sem diff, `lint`, `format:check`, `test`, `build`, `e2e` com a API no ar) e corrigir até tudo passar, com os 17 cenários verdes (SC-005)
- [ ] T168 Executar o roteiro manual do [quickstart §5](./quickstart.md) (13 passos, com um passo em fuso diferente de `America/Sao_Paulo`) e registrar os resultados num checklist em `specs/001-scheduling-web-app/checklists/smoke.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências. T001 → T002/T003 → as demais.
- **Foundational (Phase 2)**: depende da Setup e **bloqueia todas as histórias**.
- **User Stories (Phases 3–10)**: dependem da Foundational.
- **Polish (Phase 11)**: depende das histórias desejadas.

### User Story Dependencies

| História | Depende de | Observação |
|---|---|---|
| US1 (P1) | Foundational | independente |
| US2 (P1) | Foundational | independente (o `AuthApi` está na Foundational) |
| US3 (P1) | US1 (`availability-picker`, `providers.api`, `services.api`) | o login da US2 é usado no cenário 2, mas o resto da US3 pode ser testado com sessão injetada (T073) |
| US4 (P1) | Foundational | independente da US1–US3; cria `cancel-dialog` e `AppointmentsApi.get/cancel`, reutilizados depois |
| US5 (P2) | US4 (`cancel-dialog`, `appointments.api.get/cancel`, `provider.routes.ts`) | |
| US6 (P2) | US3 (`booking.store`/`booking.page`) e US5 (`appointment-detail.page`) | |
| US7 (P3) | Foundational; os links usam as rotas de detalhe da US5/US6/US8 | a página funciona sozinha |
| US8 (P3) | US5 (`appointment-detail.page`) e US4 (`cancel-dialog`) | |

### Within Each User Story

- Os testes (Vitest e E2E) são escritos **antes** e devem falhar.
- Serviços de API → stores → componentes → páginas → rotas.
- Tarefas que editam o mesmo arquivo de outra história (ex.: `appointments.api.ts`, `booking.store.ts`, `appointment-detail.page.ts`) seguem a ordem das fases.

### Parallel Opportunities

- Setup: T004–T008, T010 e T011 em paralelo, depois de T001–T003.
- Foundational: os blocos de testes (T021, T023, T025, T027, T030, T032, T034, T037, T039, T042, T046, T048, T050, T064) e os componentes de UI (T053–T063) são todos [P].
- Depois da Foundational, **US1, US2 e US4** podem andar em paralelo (pessoas diferentes); a US3 começa assim que a US1 entrega o `availability-picker`.

---

## Parallel Example: User Story 1

```bash
# Testes primeiro, juntos:
Task: "T074 Testes de contrato providers.api.spec.ts e services.api.spec.ts"
Task: "T075 E2E src/e2e/catalog.e2e.ts (cenários 1 e 6)"

# Depois, serviços e textos em paralelo:
Task: "T076 providers.api.ts (search, getPublic, availability)"
Task: "T077 services.api.ts (listPublic)"
Task: "T078 catalog.messages.ts"
Task: "T080 availability-picker.component.ts" + "T081 availability-picker.component.spec.ts"
```

## Parallel Example: User Story 4

```bash
Task: "T106 providers.api.ts (getMe, updateMe, updateBookingPolicy)"
Task: "T107 services.api.ts (listMine, create, update, delete, setStatus)"
Task: "T108 schedule.api.ts (#20–#24)"
Task: "T109 appointments.api.ts (get, cancel)"
Task: "T110 provider.messages.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) e Phase 2 (Foundational).
2. Phase 3 (US1): a vitrine pública, com busca e horários livres.
3. **Parar e validar**: `catalog.e2e.ts` verde e os portões de qualidade passando.

### Incremental Delivery (sugestão alinhada ao "módulo por módulo")

1. Setup + Foundational → base pronta.
2. **US1** (vitrine) → **US2** (contas e sessão) → **US4** (oferta do prestador) → **US3** (reserva): fecha o ciclo P1, quando um prestador configura e um cliente reserva.
3. **US5** (agenda do prestador) → **US6** (área do cliente e reagendamento).
4. **US7** (notificações) → **US8** (admin).
5. Polish: inventário das 34 operações, catálogo de erros, acessibilidade, orçamento de bundle, os 17 cenários E2E e o roteiro manual.

Cada módulo termina com os seus testes verdes e com `lint`, `test` e `build` sem avisos (Art. IV.2).

---

## Notes

- [P] = arquivos diferentes, sem dependência pendente.
- O rótulo [Story] liga a tarefa à história para rastreabilidade (Art. I.2).
- Nunca silenciar um teste que falha nem relaxar uma regra de lint para "fechar" uma tarefa (Art. V.3).
- Se uma tela precisar de algo que o contrato não oferece, **não** contorne: registre como lacuna na spec (FR-001).
