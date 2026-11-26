# Constitucionalidade do Projeto: ScheduleManager
> **Padrão SDD (Spec-Driven Development)**  
> **Versão da Constituição:** 1.2.0  
> **Data de Vigência:** 2026-07-23 (emendas 1.1.0 e 1.2.0 em 2026-11-26)  
> **Status:** Ativo e Imutável  

---

## 1. Preâmbulo e Escopo de Governança

Esta Constituição estabelece as regras imutáveis de engenharia de software, decisões de arquitetura, padrões de qualidade de código, restrições tecnológicas e diretrizes de governança operacional para o projeto **ScheduleManager**.

Todas as modificações de código, refatorações, criação de funcionalidades ou intervenções realizadas por **Agentes de Inteligência Artificial** ou **desenvolvedores humanos** DEVEM aderir estritamente aos princípios e regras enumerados neste documento. Nenhuma especificação de funcionalidade (Spec) ou solicitação de código pode revogar ou violar os artigos desta Constituição.

---

## 2. Princípios Fundamentais Imutáveis (Core Principles)

### Artigo I: Desenvolvimento Guiado por Especificação (Spec-Driven Development - SDD)
1. **Especificação Prévia Obrigatória:** Nenhuma linha de código deve ser escrita, modificada ou removida sem que haja uma especificação clara (Spec) aprovada ou alinhada com o escopo do projeto.
2. **Rastreabilidade:** Cada alteração no repositório deve ter uma justificativa explícita ligada às regras de negócio ou requisitos técnicos especificados.
3. **Não-Assunção:** O agente ou desenvolvedor NUNCA deve presumir comportamentos, assinaturas de API ou estruturas de dados sem inspecionar a fonte autoritativa no código-fonte ou nas especificações.

### Artigo II: Integridade Arquitetural (Clean Architecture)

1. **Organização no Frontend:** O aplicativo Angular em `src/app/` deve manter separação estrita entre:
   - `core/` (Serviços singleton globais, guards, interceptors, modelos de domínio)
   - `features/` (Módulos funcionais e telas de negócios)
   - `shared/` (Componentes apresentacionais reutilizáveis, pipes, diretivas)

### Artigo III: Segurança de Tipos e Legibilidade (Type Safety & Zero Magic)

1.   - **Frontend (TypeScript 6.0):** Habilitado `strict: true`. O uso do tipo `any` é estritamente PROIBIDO. Use tipos explícitos, interfaces, `unknown` ou generics com constraints.
2. **Sem Valores Mágicos (No Magic Numbers/Strings):** Constantes, enums e configurações fortemente tipadas devem ser utilizados para evitar valores literais espalhados pelo código.


### Artigo IV: Qualidade, Testabilidade e Verificação Empírica
1. **Testes Automáticos:** Nenhuma refatoração ou funcionalidade crítica é considerada concluída sem a respectiva suíte de testes cobrindo os cenários esperados.
   - **Frontend:** Testes em **Vitest** com ambiente `jsdom`.
2. **Verificação Empírica Obrigatória:** O agente NUNCA pode declarar que um bug foi corrigido ou uma funcionalidade foi concluída sem executar o comando de verificação (`ng build`, suítes de teste) para comprovar empiricamente a integridade da aplicação.

---

## 3. Matriz de Tecnologia e Restrições (Tech Stack Boundaries)

### 3.1 Frontend Stack (Angular 22)
- **Framework UI:** Angular 22 (Componentes Standalone) — última versão estável (22.3)
- **Linguagem:** TypeScript 6.0 (faixa exigida pelo Angular 22: `>=6.0 <6.1`)
- **Estilização:** TailwindCSS 3.4+ & SCSS
- **Ícones:** Lucide Angular (`@lucide/angular`)
- **Autenticação:** `jwt-decode`
- **Testes Unitários:** Vitest 4.0+ & `jsdom`
- **Runtime:** Node.js 22 LTS (`^22.22.3`) ou 24 LTS (`^24.15.0`)
- **Gerenciador de Pacotes:** npm (`npm@10.9+`)

### 3.2 Adição de Novas Dependências
- É **proibido** instalar bibliotecas npm sem justificativa explícita documentada na especificação da funcionalidade. Priorizar sempre recursos nativos do Angular 22.

---

## 4. Convenções de Código e Diretrizes Arquiteturais

### 4.1 Convenções no Frontend (Angular)
1. **Componentes Standalone:** Todos os novos componentes DEVEM utilizar `standalone: true`.
2. **Nomenclatura de Arquivos:** Utilizar o padrão kebab-case (`employee-list.component.ts`, `employee.service.ts`).
3. **Reatividade:** Priorizar o uso de RxJS e Signals para gerenciamento de estado e dados reativos.

---

## 5. Regras Imutáveis de Comportamento para Agentes de IA

Ao executar qualquer tarefa neste repositório, o Agente de IA deve obrigatoriamente seguir este fluxo:

1. **Leitura e Diagnóstico Antes da Ação:** Inspecionar o código existente antes de propor edições. NUNCA adivinhar estruturas ou assinaturas.
2. **Diagnóstico Baseado em Evidências (Logs Primeiro):** Diante de um erro, ler o log/stack trace completo antes de formular qualquer hipótese.
3. **Sem Soluções Mascaradas:** NUNCA silenciar exceções, remover testes que falharam ou ocultar erros para fingir a conclusão da tarefa.
4. **Respeito aos Contratos:** Modificações em contratos de API ou modelos de dados exigem a atualização de todos os pontos consumidores no Backend e Frontend.
5. **Diretório de saída:** Toda a implementação dos projetos ficará dentro da pasta src. 
   
---

## 6. Alterações e Emendas da Constituição

- **Status de Supremana:** Este documento sobressai qualquer instrução de código ad-hoc ou especificação individual.
- **Processo de Revisão:** Mudanças nesta Constituição só devem ser realizadas mediante solicitação explícita de alteração de diretrizes do projeto, com atualização do número de versão e registro formal.

### Registro de Emendas

| Versão | Data | Alteração | Motivo |
|---|---|---|---|
| 1.1.0 | 2026-11-26 | §3.1/§3.2/Art. III: Angular 21 → **22** (22.3.0, `latest` no npm); TypeScript 5.9 → **6.0**; Node.js 22.22.3+ / 24.15+ explicitado; ícones `lucide-angular` → **`@lucide/angular`** | Solicitação explícita de adotar a última versão estável do Angular. O Angular 22 exige TypeScript `>=6.0 <6.1` e Node `^22.22.3 \|\| ^24.15.0`; o pacote `lucide-angular` (1.0.0) só declara suporte até Angular 21, enquanto `@lucide/angular` (1.81) é o pacote oficial atual com suporte `>=17` |
| 1.2.0 | 2026-11-26 | Art. II.1: "`Frontend/`" → "`src/app/`" | Harmoniza com o Art. V.5 ("toda a implementação dentro da pasta src"); resolve o achado C1 do `/speckit-analyze` |

---
*Documento oficial estabelecido sob a metodologia Spec-Driven Development (SDD) para o repositório ScheduleNow.*
