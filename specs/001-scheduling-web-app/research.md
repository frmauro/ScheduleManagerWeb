# Fase 0 — Pesquisa: ScheduleManager Web

**Feature**: `001-scheduling-web-app` | **Data**: 2026-11-25 | **Spec**: [spec.md](./spec.md) | **Plano**: [plan.md](./plan.md)

Cada item resolve uma incógnita do Contexto Técnico ou um conflito briefing × constituição. Em conflito, **a constituição prevalece** (Art. 6).

Versões conferidas em 2026-11-26 (`npm view`, tag `latest`): Angular CLI 22.3.0, `@angular/core` 22.3.0, `@angular/cdk` 22.3.0, TypeScript 6.0.3 (o Angular 22 exige `>=6.0 <6.1`; o TS 7 não é suportado), npm 10.9.3, `tailwindcss@3` 3.4.19, `@lucide/angular` 1.81.0, `jwt-decode` 4.0.0, `@playwright/test` 1.65.1, `openapi-typescript` 7.13.0, `vitest` 5.1.2 (o builder do Angular 22 aceita `^4.0.8 || ^5.0.0`; a constituição pede "4.0+", então fica a **5.x**). **Node**: o Angular 22 exige `^22.22.3 || ^24.15.0`; a máquina de desenvolvimento tem 22.20.0 e precisa atualizar para a 22 LTS mais recente (22.23.x) antes do `npm ci`.

---

## R1 — Framework e modelo de componentes

- **Decisão**: Angular 22.3 (última estável; constituição 1.1.0) com componentes standalone (`standalone: true` escrito explicitamente, como exige o §4.1), signals para estado, *control flow* `@if`/`@for`, Reactive Forms tipados, guards/interceptors/resolvers funcionais, rotas *lazy* (`loadChildren`/`loadComponent`) por área e detecção de mudanças **zoneless** (padrão desde o Angular 21) com `OnPush` em todos os componentes.
- **Justificativa**: Atende §3.1 e o briefing §6. Zoneless + signals reduz trabalho de renderização no celular, prioridade do fluxo de reserva.
- **Alternativas**: NgModules (vetado pela constituição); Zone.js (desnecessário com signals e aumenta o bundle).

## R2 — Biblioteca de UI (conflito briefing × constituição)

- **Decisão**: **TailwindCSS 3.4 + SCSS + Lucide Angular (`@lucide/angular`)**, conforme a constituição. O pacote antigo `lucide-angular` declara suporte só até o Angular 21. Componentes apresentacionais próprios em `shared/ui` (botão, campo, select, diálogo, toast, badge de status, abas, paginação, estado vazio, skeleton, calendário dia/semana). Para as primitivas de acessibilidade difíceis, usa **`@angular/cdk`** (`a11y`: `FocusTrap`, `LiveAnnouncer`, `FocusMonitor`; `dialog`/`overlay`: modais e popovers; `layout`: breakpoints).
- **Justificativa (§3.2)**: A constituição fixa Tailwind + Lucide e veta dependências sem justificativa. O CDK é oficial do Angular e sem estilo (não concorre com o Tailwind), e cobre requisitos WCAG 2.1 AA (foco preso em diálogos, anúncio de erros e do aviso de sessão a leitores de tela — FR-011/FR-017a) que seriam caros e arriscados de escrever à mão.
- **Alternativas**: Angular Material (conflita com o Tailwind da constituição e duplica o design system); bibliotecas *headless* de terceiros (não oficiais, mais risco); tudo à mão sem CDK (alto risco de acessibilidade).

## R3 — Testes unitários e de componente

- **Decisão**: **Vitest 5.x + jsdom** via builder `@angular/build:unit-test` (`ng test`). `HttpTestingController` para serviços e interceptors; `TestBed` para os componentes críticos (reserva, cancelar/reagendar, editor de expediente, aviso de sessão). Padrão de nome `*.spec.ts`.
- **Justificativa**: Constituição Art. IV §1 e §3.1. O briefing aceitava Vitest ou Jest; o Jest fica fora.
- **Alternativas**: Jest, Karma/Jasmine (vetados).

## R4 — Testes E2E

- **Decisão**: **`@playwright/test` 1.65** (dependência de desenvolvimento), com testes em `src/e2e/**/*.e2e.ts` contra a API real em dev (`https://localhost:7154`) e o servidor de desenvolvimento do Angular com proxy. Inclui **`@axe-core/playwright`** para checagem automática de acessibilidade nas telas críticas (SC-009).
- **Justificativa (§3.2)**: O SC-005 exige que os 17 cenários obrigatórios passem ponta a ponta contra a API real (duas abas, duplo clique, sessão expirada, fuso). Não há ferramenta nativa do Angular para E2E (o Protractor foi descontinuado). O Playwright oferece múltiplos contextos (cenário 12), controle de relógio (sessão e "após o início") e emulação de fuso (`timezoneId`, cenários 1 e 3).
- **Alternativas**: Cypress (fraco com múltiplas abas/contextos); só testes unitários (não atendem o SC-005).

## R5 — Tipos TypeScript fiéis ao contrato

- **Decisão**: Gerar `src/app/core/api/schema.gen.ts` com **`openapi-typescript` 7** (dependência de desenvolvimento) a partir de `../api/specs/001-online-scheduling-api/contracts/openapi.yaml` (`npm run api:types`). Os modelos em `core/models/*.ts` são **aliases** dos tipos gerados (`type Appointment = components['schemas']['Appointment']`), sem nenhum campo inventado. Enums de tempo de execução são arrays `as const` checados com `satisfies readonly components['schemas']['Role'][]`, o que atende "sem strings mágicas" e quebra o build se o contrato mudar. A CI roda `api:types` e falha se houver diferença (`git diff --exit-code`).
- **Compatibilidade com TS 6**: o `openapi-typescript` 7.13 declara `peerDependencies.typescript: ^5.x`, mas o projeto usa TS 6.0. Ele é só uma ferramenta de geração e não entra no bundle, então o `package.json` declara `"overrides": { "openapi-typescript": { "typescript": "$typescript" } }` para o `npm ci` não falhar. A primeira tarefa de setup confirma empiricamente que `npm run api:types` gera o arquivo sem erros com o TS 6. Se falhar, o script passa a rodar isolado com `npx -p typescript@5.9 -p openapi-typescript@7.13.0 openapi-typescript …`, sem afetar o TS do projeto. **Validado em 2026-11-26 (T009)**: `npm run api:types` gera o arquivo sem erros com TS 6.0.3 e o `override`; o plano alternativo não foi necessário.
- **Justificativa (§3.2)**: A fidelidade ao contrato (FR-001, Art. I §3 "Não-Assunção", Art. V §4) exige tipos derivados da fonte autoritativa. Pacote só de desenvolvimento, sem impacto em tempo de execução.
- **Alternativas**: Modelos à mão (risco de divergência em 34 operações); gerador de cliente completo (`openapi-generator`, `orval`), rejeitado porque gera serviços fora das convenções de interceptor e erro do projeto.

## R6 — Sessão: armazenamento, expiração e aviso

- **Decisão**: `SessionStore` (signal) em memória, espelhado em **`sessionStorage`** (chave `sm.session`: `accessToken`, `expiresAt`, `user`). O `expiresAt` da API comanda a expiração; o `jwt-decode` (já previsto na constituição) lê o `exp` só como checagem de consistência ao restaurar. Na inicialização (`provideAppInitializer`): restaurar → se expirada, descartar → senão `GET /auth/me` para validar. Temporizadores: em `expiresAt − 5 min`, aviso não bloqueante em `aria-live`, uma única vez (FR-017a); em `expiresAt`, expira (FR-017). Qualquer `401` (exceto em `/auth/login`, onde o 401 significa credenciais inválidas) limpa a sessão e leva a `/entrar?returnUrl=…&motivo=sessao-expirada`.
- **Justificativa**: O `sessionStorage` sobrevive ao recarregamento na mesma aba (FR-018) e é apagado ao fechar a aba, o que reduz a exposição em computadores compartilhados. A exposição a XSS é a mesma do `localStorage`, mitigada pela sanitização padrão do Angular e pela proibição de `innerHTML` com dados da API. A API emite token Bearer sem renovação, o que descarta cookie HttpOnly. O token nunca vai para URL nem para logs (FR-021).
- **Alternativas**: `localStorage` (persiste entre abas e reaberturas, mais exposição); só memória (perde a sessão ao recarregar, viola o FR-018).

## R7 — Fusos horários e datas

- **Decisão**: **`Intl.DateTimeFormat`** nativo com `timeZone` = `timeZoneId` do prestador, sem biblioteca. Funções puras em `shared/time/`:
  - `formatInZone(instant, tz)` → `dd/MM/yyyy HH:mm`;
  - `zoneLabel(tz)` → nome e offset do fuso (`longGeneric` / `longOffset`), exibido quando `tz` difere do fuso do navegador;
  - `zonedDayRange(date, tz)` / `zonedWeekRange(date, tz)` → `from`/`to` em ISO com o offset do fuso à meia-noite local (offset obtido com `formatToParts` + `longOffset`, correto nas mudanças de horário de verão);
  - `todayInZone(tz)` → `yyyy-MM-dd` para o calendário de reserva.

  O `startAt` do slot é tratado como **string opaca** e nunca é convertido (FR-026).
- **Justificativa**: O Intl cobre fusos IANA e horário de verão sem custo de bundle, e a lógica restante é pequena e testável.
- **Alternativas**: `date-fns-tz` / `luxon` (dependência sem necessidade).

## R8 — HTTP: interceptors, erros e nova tentativa

- **Decisão**: Interceptors funcionais, nesta ordem:
  1. `apiBaseUrlInterceptor` prefixa `environment.apiBaseUrl` (`/api/v1`);
  2. `authInterceptor` adiciona `Authorization: Bearer` quando há sessão;
  3. `errorInterceptor` normaliza `HttpErrorResponse` → `ApiError` (`kind: 'problem' | 'network' | 'unknown'`, `problem` tipado, `status`) e trata `401` (sessão), `403` (toast "Você não tem permissão"; em navegação, `/sem-permissao`) e `0`/`5xx` (erro com "Tentar novamente" e `traceId`).

  Não há nova tentativa automática; a única repetição é o reenvio manual da reserva com a mesma `Idempotency-Key`.
- **Justificativa**: Centralizar erros atende FR-006/FR-047. Repetir POST automaticamente seria inseguro fora da reserva idempotente.
- **Alternativas**: Interceptors em classe (legado); retry global (quebra a semântica de POST).

## R9 — Concorrência otimista (ETag / If-Match)

- **Decisão**: `AppointmentsApi.get(id)` usa `observe: 'response'` e devolve `{ appointment, etag }`, com `etag = headers.get('ETag') ?? \`W/"${appointment.version}"\``. As ações `confirm`/`cancel`/`complete` recebem o `etag` exibido e devolvem o novo `{ appointment, etag }`. Em `412 appointment.precondition_failed` ou `409 appointment.concurrency_conflict`, o detalhe mostra "Este agendamento foi alterado por outra pessoa" e recarrega.
- **Justificativa**: FR-048 e cenário 12. O proxy pode remover o header, por isso o fallback para `version`, que o contrato garante ser o mesmo valor.

## R10 — Idempotência da reserva

- **Decisão**: `BookingAttemptStore` guarda `{ providerId, serviceId, startAt, notes, idempotencyKey }`. A chave (`crypto.randomUUID()`) nasce ao abrir o resumo e só é **regenerada** quando o conteúdo muda (outro horário, serviço ou observação). Reenvios (duplo clique, nova tentativa após falha de rede) reutilizam a chave. Uma resposta `200` (repetição) é tratada como `201`. `422 idempotency.key_reused` (caso defensivo) → nova chave e mensagem.
- **Justificativa**: FR-027, SC-002 e cenário 4. O botão fica desabilitado durante o envio (FR-005), e a chave cobre o que escapar disso.

## R11 — Retomar a reserva após o login e fluxo de reagendamento

- **Decisão**: Todo o estado da reserva fica na URL (`/prestadores/:id/agendar?servico=…&data=…&horario=<startAt codificado>`); as observações ficam como rascunho em `sessionStorage` (`sm.booking-draft`). Sem sessão de Cliente, confirmar leva a `/entrar?returnUrl=<url da reserva>` (com link para `/cadastro?returnUrl=…`). Após login ou cadastro, o `returnUrl` tem prioridade (FR-016) e é validado como caminho interno (proteção contra *open redirect*). Reagendamento: `/prestadores/:id/agendar?servico=…&reagendar=<appointmentId>`. Nesse modo, o resumo mostra o horário atual e o novo, e a confirmação executa `cancel(etag, motivo)` e em seguida `create(...)` (FR-035/035a).
- **Justificativa**: A URL é compartilhável, sobrevive ao redirecionamento de login e atende o cenário 2 sem estado global.

## R12 — Textos pt-BR e locale

- **Decisão**: Idioma único, portanto **sem** extração via `@angular/localize`. Textos de interface em constantes tipadas por área (`core/i18n/*.messages.ts`); catálogo de erros por `code` em `core/errors/error-messages.ts` (ver [contracts/error-catalog.md](./contracts/error-catalog.md)). `registerLocaleData(localePt)`, `LOCALE_ID = 'pt-BR'`, `DEFAULT_CURRENCY_CODE = 'BRL'`. Rótulos de categoria, status, tipo de notificação e dia da semana em mapas tipados `Record<Enum, string>`.
- **Justificativa**: Atende "textos centralizados" do briefing e "sem valores mágicos" (Art. III §2) sem custo de build.

## R13 — Máscaras e validadores

- **Decisão**: Diretivas próprias `smPhoneBr` (exibe `(11) 99999-8888` ↔ valor `+5511999998888`) e `smCep` (`00000-000` ↔ `00000000`), e validadores puros em `shared/forms/validators.ts` espelhando o contrato (tamanhos, regex E.164, UF, CEP, senha com letra e dígito, múltiplo de 5, faixas sem sobreposição).
- **Alternativas**: `ngx-mask` (dependência para dois campos simples).

## R14 — Lint e formatação (briefing × constituição)

- **Decisão**: `angular-eslint` (com `typescript-eslint` e a regra `@typescript-eslint/no-explicit-any: error`) e `prettier` como dependências de desenvolvimento; `npm run lint` e `npm run format:check` na CI.
- **Justificativa (§3.2)**: Garante automaticamente o Art. III §1 (`any` proibido) e o Art. III §2. Só desenvolvimento.

## R15 — Local do código

- **Decisão**: Workspace Angular em `web/` (`package.json`, `angular.json`, configurações), com **toda a implementação em `web/src/`** (`sourceRoot: "src"`): aplicação em `src/app/` e E2E em `src/e2e/`. A divisão `core/`, `features/`, `shared/` do Art. II vale dentro de `src/app/`.
- **Justificativa**: Art. II.1 ("aplicativo Angular em `src/app/`", emenda 1.2.0) e Art. V.5 ("toda a implementação dentro da pasta src").

## R16 — Calendário do prestador e volume paginado

- **Decisão**: As visões dia/semana chamam `GET /providers/me/appointments` com `from`/`to` no fuso do prestador (R7), `pageSize=100` e `sort=startAt`, seguindo `totalPages` até completar (o volume esperado de uma semana é menor que 100). A visão de lista usa paginação normal.
- **Justificativa**: A API limita `pageSize` a 100, e o calendário não pode omitir agendamentos.

## R17 — Checklist e lacunas restantes da API

- **Decisão**: O checklist é calculado com `GET /providers/me/services?isActive=true&pageSize=1` (`totalCount ≥ 1`) e `GET /providers/me/schedule` (`days.length ≥ 1`) (FR-037). O calendário de reserva permite de hoje até +365 dias no fuso do prestador e trata `availability.beyond_horizon` (FR-031). Não há listagem geral de agendamentos para o Admin nem recuperação de senha (FR-054).

## R18 — Fuso nas listas de agendamentos (lacuna do contrato)

- **Decisão**: o `AppointmentSummary` (#7, #13, `affectedAppointments`) não traz `timeZoneId`. Nas telas do prestador, usa-se o `timeZoneId` de `GET /providers/me`. Em "Meus agendamentos" do cliente, um cache em memória por sessão resolve o fuso de cada `providerId` distinto via `GET /providers/{providerId}` (público, uma chamada por prestador). Se a resposta for `404` (prestador desativado), a data é exibida no fuso do dispositivo com o rótulo "no seu fuso". O detalhe (`Appointment.provider.timeZoneId`) é sempre a fonte final.
- **Justificativa**: o FR-003 exige o fuso do prestador sem inventar campos (FR-001), e a operação #9 já existe. O custo é baixo: poucos prestadores distintos por página.
- **Alternativas**: exibir no fuso do navegador (viola o FR-003); pedir alteração da API (fora do escopo, a API não é alterada).
