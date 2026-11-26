# Quickstart — Validação do ScheduleManager Web

**Feature**: `001-scheduling-web-app` | Guia para executar e validar a aplicação de ponta a ponta. Detalhes de design ficam em [plan.md](./plan.md), [data-model.md](./data-model.md) e [contracts/](./contracts/).

## 1. Pré-requisitos

| Item | Versão | Verificação |
|---|---|---|
| Node.js | 22 LTS ≥ 22.22.3 (ou 24 LTS ≥ 24.15.0), exigido pelo Angular 22 | `node -v` |
| npm | ≥ 10.9 | `npm -v` |
| .NET SDK (para rodar a API) | o exigido por `api/src` | `dotnet --version` |
| Navegadores do Playwright | instalados uma vez | `npx playwright install chromium` |
| Certificado de desenvolvimento HTTPS da API | confiável | `dotnet dev-certs https --trust` |

## 2. Subir a API (fonte da verdade)

```powershell
cd C:\projetos\scheduleManager\api\src
dotnet run --project Scheduling.Api --launch-profile https   # https://localhost:7154 (Swagger em /swagger)
```

O Admin de desenvolvimento já vem provisionado: `admin@schedulemanager.local` / `Admin12345`.

## 3. Subir o front-end

```powershell
cd C:\projetos\scheduleManager\web
npm ci
npm run api:types        # gera src/app/core/api/schema.gen.ts a partir do openapi.yaml da API
npm start                # ng serve --proxy-config proxy.conf.json → http://localhost:4200
```

`proxy.conf.json` mapeia `/api` → `https://localhost:7154` com `secure: false`, porque a API não habilita CORS. Para o perfil `http` da API, troque o `target` por `http://localhost:5002`.

## 4. Portões de qualidade (Art. IV §2: verificação empírica obrigatória)

| Comando | Esperado |
|---|---|
| `npm run api:types && git diff --exit-code src/app/core/api/schema.gen.ts` | sem diferença (tipos fiéis ao contrato) |
| `npm run lint` | 0 erros, 0 avisos (inclui `no-explicit-any`) |
| `npm run format:check` | sem arquivos fora do padrão |
| `npm test` (`ng test`, Vitest + jsdom) | todos os testes passam |
| `npm run build` (`ng build`, produção) | build sem erros **e sem avisos** (inclui orçamento de bundle) |
| `npm run e2e` (Playwright, com API e front no ar) | os 17 cenários passam (SC-005) |

## 5. Roteiro de validação manual (smoke)

Use o fuso do navegador diferente de `America/Sao_Paulo` em ao menos um passo (ex.: DevTools → Sensors → Location, ou `timezoneId` no Playwright) para validar a indicação de fuso.

1. **Prestador**: `/cadastro/prestador` → complete as 3 etapas → veja o checklist → crie o serviço "Corte" (30 min, R$ 50,00) → expediente de segunda a sexta 09:00–12:00 e 13:00–18:00 → o checklist some (US4, FR-037).
2. **Faixa inválida**: no expediente, adicione 11:00–14:00 numa segunda → erro na faixa, sem requisição na aba Network (cenário 9).
3. **Visitante**: em outra janela anônima, `/` → filtre por categoria e cidade → abra o prestador → escolha "Corte" e uma segunda-feira → horários de 09:00 a 11:30 e de 13:00 em diante, nenhum entre 12:00 e 13:00, com o fuso indicado (cenários 1 e 8).
4. **Reserva com login**: escolha um horário → "Reservar" → cadastre-se como cliente → volta ao resumo com as mesmas escolhas → dê duplo clique em "Confirmar" → **um** agendamento, status **Pendente** (cenários 2, 3 e 4).
5. **Disponibilidade**: recarregue a data → o horário reservado e os sobrepostos sumiram (cenário 3).
6. **Prestador confirma**: `/prestador/agenda` → o pendente aparece destacado → confirme → **Confirmado**; tente concluir → ação indisponível antes do início (cenário 11).
7. **Duas abas**: abra o mesmo agendamento em duas abas do prestador → cancele numa → tente confirmar na outra → aviso "alterado por outra pessoa" e status atualizado (cenário 12).
8. **Cliente cancela**: em `/cliente/agendamentos/:id`, veja o aviso fixo da antecedência → cancele com motivo → **Cancelado pelo cliente** (cenário 7).
9. **Férias**: o prestador cria uma exceção de fechamento cobrindo a data de um agendamento → o painel lista o agendamento afetado (cenário 10); a disponibilidade dessa data fica vazia, sem erro (cenário 6).
10. **Admin**: entre como Admin → desative o prestador → ele some da busca pública; a linha do próprio Admin não permite desativar (cenário 15) → em `/admin/notificacoes`, abra um agendamento e cancele "em nome do cliente" (cenário 16).
11. **Sessão**: com o relógio do navegador adiantado (Playwright `page.clock`) para 55 min, aparece o aviso de 5 min; aos 60 min, qualquer ação leva a `/entrar?returnUrl=…` e, após entrar, você volta à página (cenários 13 e FR-017a).
12. **Permissão**: como cliente, abra `/prestador/agenda` → `/sem-permissao` (cenário 14).
13. **Validação 400**: como o front espelha as regras da API, o 400 real é provocado no E2E: `page.route` altera o corpo enviado no cadastro de prestador (ex.: `address.postalCode = "123"`) e a **API real** responde `400 validation.failed` → o erro aparece no campo CEP da etapa Endereço (cenário 17).

## 6. Mapa de cenários → testes E2E

| Arquivo (`src/e2e/`) | Cenários do briefing §7 |
|---|---|
| `catalog.e2e.ts` | 1, 6 |
| `booking.e2e.ts` | 2, 3, 4, 5 |
| `customer-appointments.e2e.ts` | 7 |
| `provider-setup.e2e.ts` | 8, 9, 10 |
| `provider-agenda.e2e.ts` | 11, 12 |
| `session-and-access.e2e.ts` | 13, 14 |
| `admin.e2e.ts` | 15, 16 |
| `form-validation.e2e.ts` | 17 |

Os dados de teste são criados via API em `src/e2e/fixtures/` (cadastro de prestador e cliente com e-mails únicos por execução), sem depender de estado prévio além do Admin provisionado. O cenário 11 ("concluir após o início") depende do relógio **do servidor**, então `page.clock` não basta: a fixture configura `slotStepMinutes = 5` e `minBookingNoticeMinutes = 0`, reserva o próximo slot disponível de hoje e o teste aguarda até `startAt` (≤ 5 min; teste marcado como lento). `page.clock` é usado apenas para a expiração de sessão no navegador (cenário 13).
