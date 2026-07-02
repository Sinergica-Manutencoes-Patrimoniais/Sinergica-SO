# Sinérgica SO

Sistema operacional completo da **Sinérgica Manutenções Patrimoniais** (Campinas/SP) — empresa de
manutenção predial que atende condomínios residenciais e comerciais. Centraliza desde a captação
comercial até a execução técnica em campo, faturamento e prestação de contas ao cliente.

> Status: **casca (Mês 1)** · Desenvolvido pela **Trívia Studio** seguindo o **Padrão SO v2** (SDD + Triviaiox).
> Contexto completo em [`CLAUDE.md`](CLAUDE.md), [`docs/PROJECT.md`](docs/PROJECT.md) e [`docs/STATE.md`](docs/STATE.md).

## O que é

O **PCM** (Planejamento e Controle de Manutenção) é o núcleo operacional e o *system of record* da
operação. O **Auvo** é o braço de campo insubstituível (app móvel dos técnicos — check-in GPS,
fotos, checklist, assinatura offline). O Sinérgica SO integra os dois e adiciona os módulos de
comercial, financeiro, atendimento via IA, marketing, growth, gestão e portal do cliente.

## Bounded contexts (9 módulos)

| # | Contexto | Feature | Descrição | Schema Postgres |
|---|----------|---------|-----------|-----------------|
| 1 | PCM / Operação | `pcm` | Chamados, backlog GUT, visitas, preventivo, inspeções, relatórios diário/mensal, laudos SPDA | `pcm` |
| 2 | Atendimento (IA/Zé) | `atendimento` | Agente Zé no WhatsApp — porta única de chamados; fila + detecção determinística | `atendimento` |
| 3 | Comercial | `comercial` | CRM, funil de prospects, propostas, contratos mensais | `comercial` |
| 4 | Financeiro | `financeiro` | Faturamento, contas a receber, custo por OS, rentabilidade por contrato | `financeiro` |
| 5 | Operação & Estoque | `operacao` | Catálogo de materiais, estoque, custo de MO+materiais, Volante | `estoque` |
| 6 | Marketing | `marketing` | Conteúdo multicanal, automação de publicações | `marketing` |
| 7 | Growth | `growth` | Análise Meta Ads / Google Ads, atribuição de leads | `growth` |
| 8 | Gestão (Cockpit) | `gestao` | Dashboards, SLA, produtividade, rentabilidade — views sobre os outros schemas | (views) |
| 9 | Área do Cliente | `area-cliente` | Portal do síndico — chamados, relatórios, histórico | (views `pcm`) |

Detalhes de arquitetura e context-map em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Papéis de usuário

| Papel | Acesso |
|-------|--------|
| `admin` | Acesso total; configura Agente Zé, integrações, usuários |
| `escritorio` | Operacional — clientes, chamados, backlog, visitas, propostas, relatórios, planos |
| `tecnico` | Restrito — leitura geral + escrita no próprio (OS onde é responsável, inspeções) |
| `cliente-sindico` | WhatsApp (Zé) + Portal (Área do Cliente) — só dados do próprio condomínio |

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19 · Vite 5 · TypeScript 5 (strict) · Tailwind CSS 3 · TanStack Router/Query |
| Backend | Supabase (Postgres + Edge Functions Deno + Storage) |
| Deploy | Netlify (SPA) |
| LLM | OpenRouter — Gemini 2.5 Flash (Agente Zé) · Claude (laudos, propostas) |
| WhatsApp | Evolution API (Cloudfy) |
| Campo | Auvo (app técnicos — integração bidirecional via API + webhooks) |
| Monorepo | pnpm workspaces + Turborepo |
| Qualidade | Biome (lint/format) · Vitest · Husky · Conventional Commits |

## Estrutura do repositório

```
apps/web/src/
  app/                  → bootstrap, rotas, layout
  features/<dominio>/   → domain/ · application/ · infrastructure/ por bounded context
  config/               → env, feature flags
  lib/                  → helpers (log, http/problem, etc.)
packages/
  config/ database/ shared/ ui/   → compartilhado entre features/domínios
supabase/
  migrations/, functions/          → schema por domínio, RLS FORCE, audit.* append-only
docs/                    → PROJECT.md, ARCHITECTURE.md, STATE.md, glossário, ADRs
docs/epics/ROADMAP.md    → épicos e stories, com owner de cada uma
specs/                   → spec.md + tasks.md por feature (fonte de verdade da implementação)
seguranca/               → baseline OS-grade, threat model
runbooks/, observabilidade/  → operação e monitoramento
```

## Como rodar localmente

```bash
pnpm install
cp .env.example .env.local   # preencha Supabase, Evolution API, OpenRouter, Auvo
pnpm dev                     # apps/web em modo desenvolvimento
```

Scripts úteis (raiz do monorepo):

```bash
pnpm build              # build de todos os apps/packages (Turborepo)
pnpm test                # testes (Vitest, via Turborepo)
pnpm typecheck            # checagem de tipos
pnpm lint                 # Biome check
pnpm format               # Biome format --write
pnpm audit:esteira        # audita integridade da esteira SDD (specs/docs)
pnpm eval:spec             # avalia fidelidade spec ↔ código
pnpm nova-story            # scaffold de nova story
```

## Como contribuir (processo obrigatório)

Este projeto segue **SDD (Spec-Driven Development)** com múltiplas sessões/pessoas trabalhando em
paralelo por épico. Antes de codar:

1. Leia [`docs/epics/ROADMAP.md`](docs/epics/ROADMAP.md) e marque o owner da story.
2. Crie `specs/E0N-S0N-<nome>/spec.md` + `tasks.md` antes de implementar (a spec é o contrato/AC).
3. Siga o ciclo de agentes Triviaiox: `@pm/@analyst` → `@architect` (se arquitetural) → `@sm` →
   `@dev` → `@qa` → `@devops` (único que faz merge/push/PR). Detalhes em [`AGENTS.md`](AGENTS.md).
4. Ao concluir, atualize o ROADMAP e o `docs/STATE.md`.

Convenções obrigatórias:
- **Commits:** Conventional Commits com escopo do épico/story, ex. `feat(E01-S02): descrição`.
- **Migrations:** `NNNN_E0N-S0N_descricao.sql`, sequência sempre crescente — ver [`db/README.md`](db/README.md).
- **Branches/PR:** nunca push direto em `main` — branch dedicada + `gh pr create` + merge após aprovação.

Regras completas em [`CLAUDE.md`](CLAUDE.md) e [`ANTI-PADROES.md`](ANTI-PADROES.md).

## Segurança

Projeto **OS-grade**: RLS FORCE em toda tabela, schemas isolados por domínio, `audit.*` append-only,
secrets em Vault, webhooks com HMAC, `service_role` nunca exposto ao client. Ver
[`seguranca/os-grade.md`](seguranca/os-grade.md) e [`docs/SECURITY_DEBT.md`](docs/SECURITY_DEBT.md).

## Documentação

| Assunto | Onde |
|---|---|
| Identidade e contexto do projeto | [`docs/PROJECT.md`](docs/PROJECT.md) |
| Arquitetura e context-map | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Requirements por módulo | [`docs/blueprint/`](docs/blueprint/) |
| Glossário (linguagem ubíqua) | [`docs/glossary.md`](docs/glossary.md) |
| Banco de dados / RLS | [`db/README.md`](db/README.md), [`db/rls.template.sql`](db/rls.template.sql) |
| Definition of Done (gates) | [`Definition-of-Done.md`](Definition-of-Done.md) |
| Decisões duráveis (ADRs) | [`docs/adr/`](docs/adr/) |
| Estado atual do trabalho | [`docs/STATE.md`](docs/STATE.md) |
| Épicos e stories | [`docs/epics/ROADMAP.md`](docs/epics/ROADMAP.md) |

## Contrato / partes

- Contratada: Trívia Studio (CNPJ 41.429.534/0001-15)
- Contratante: Sinérgica Manutenções (CNPJ 37.502.245/0001-27)
- Product / dono da spec: Fabrício Barbosa Nunes Medeiros (Sinérgica)
