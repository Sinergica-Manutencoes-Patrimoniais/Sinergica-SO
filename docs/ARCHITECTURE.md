---
name: ARCHITECTURE
description: Arquitetura viva do Sinérgica OS — bounded contexts, context-map, schemas. Puxe ao tocar fronteira de domínio ou ao criar migration.
alwaysApply: false
---

# ARCHITECTURE — Sinérgica OS

> Documento **vivo** — atualize quando a fronteira mudar. Decisão estrutural → ADR em `docs/adr/`.

## Visão geral
Sistema operacional multi-domínio da Sinérgica Manutenções: 9 bounded contexts num único
monorepo, com um app web (`apps/web`) feature-based, banco Postgres particionado por schema,
Edge Functions Deno no Supabase, e integração bidirecional com o Auvo (campo).

**PCM é o system of record** da operação técnica.
**Auvo é o braço de campo** — execução insubstituível (GPS, fotos, checklist, assinatura offline).

## Bounded contexts — context-map
| Contexto | Subdomínio | Schema(s) Postgres | Feature `apps/web` | Relação com outros |
|----------|------------|--------------------|--------------------|-------------------|
| **PCM / Operação** | core | `pcm` | `features/pcm` | Supplier de todos os outros (dados de OS, backlog, visitas) |
| **Atendimento (IA/Zé)** | core | `atendimento` | `features/atendimento` | Customer do PCM (abre OS); usa Shared Kernel `pcm.ordens_servico` |
| **Comercial** | supporting | `comercial` | `features/comercial` | Customer do PCM (levantamento → proposta → contrato → OS) |
| **Financeiro** | supporting | `financeiro` | `features/financeiro` | Customer do PCM (OS finalizada → custo → faturamento) |
| **Operação & Estoque** | supporting | `estoque` | `features/operacao` | Shared Kernel com PCM (catálogo de materiais) |
| **Marketing** | generic | `marketing` | `features/marketing` | Standalone |
| **Growth** | generic | `growth` | `features/growth` | Standalone |
| **Gestão (Cockpit)** | supporting | (views) | `features/gestao` | Conformist — lê `pcm`, `financeiro`, `comercial` via views |
| **Área do Cliente** | supporting | (views `pcm`) | `features/area-cliente` | Conformist — lê `pcm` via views restritas por RLS |

> Relações DDD: Customer/Supplier (PCM fornece dados), Shared Kernel (tipos partilhados via
> `packages/shared`), Conformist (contextos que lêem via views sem modificar).

## Estrutura do monorepo
```
apps/web/src/
  features/<dominio>/     ← um diretório por bounded context
    domain/               ← regras puras (sem I/O, sem framework)
    application/          ← casos de uso
    infrastructure/       ← adapters (Supabase, Auvo, Evolution...)
    pages/ components/ hooks/ types/
  lib/                    ← helpers genéricos (log, problem, supabase client)
  config/env.ts           ← variáveis tipadas e validadas no boot (fail-fast)
  app/App.tsx             ← shell + roteamento
packages/
  config/                 ← tsconfig base
  shared/                 ← schemas Zod e tipos de domínio cross-contexto
  ui/                     ← componentes base (shadcn/ui)
  database/               ← tipos gerados (supabase gen types typescript)
supabase/
  migrations/             ← schemas por domínio + RLS FORCE + audit columns
  functions/              ← Edge Functions Deno
```

**Regra de fronteira**: features de domínios diferentes **não se importam** — compartilhe só via `packages/`.

## Camadas DDD (por feature)
```
interfaces (pages/components/hooks) → application → domain ← infrastructure
```
`domain/` não importa NADA de framework, I/O ou de outro contexto.

## Dados — schemas Postgres
| Schema | Dono | Conteúdo |
|--------|------|----------|
| `pcm` | PCM/Operação | `ordens_servico`, `backlog_items`, `visitas`, `inspecoes`, `clientes`, `tecnicos`, `preventivo`, `relatorios` |
| `atendimento` | Atendimento | `wa_messages`, `wa_queue`, `agentes_config` |
| `comercial` | Comercial | `leads`, `proposals`, `contratos`, `surveys`, `materials_catalog` |
| `financeiro` | Financeiro | `faturas`, `contas_receber`, `custos_os` |
| `estoque` | Operação | `materiais`, `movimentacoes`, `estoque_atual` |
| `marketing` | Marketing | `conteudos`, `publicacoes`, `campanhas` |
| `growth` | Growth | `leads_ads`, `atribuicoes`, `metricas_canal` |
| `audit` | Governança | Tabelas append-only (histórico de mudanças críticas) |
| `lgpd` | Governança | Consentimentos, pedidos de export/delete |
| `config` | Governança | Configurações de sistema (Zé, integrações, papéis) |

**Governança de banco:**
- RLS FORCE em toda tabela (nem service_role escapa nas tabelas de negócio).
- Colunas de auditoria em toda tabela: `created_at`, `created_by`, `updated_at`, `updated_by`, `deleted_at`.
- `audit.*` append-only: policies negam UPDATE/DELETE para todos.
- Espelhos (`*_cache`): o app só lê; sync externo escreve (ex.: `pcm.equipamentos_cache` ← Auvo).
- Idempotência em escritas críticas: `externalId unique` no Auvo, `numero_os serial` no PCM.

## Integração Auvo — divisão de trabalho
| Domínio | Dono | Fluxo |
|---------|------|-------|
| Clientes/condomínios | PCM | PCM → Auvo (cria/atualiza via API) |
| Equipamentos/ativos | PCM | PCM → Auvo (cache: Auvo → PCM espelho) |
| Técnicos | Auvo | Auvo → PCM (espelho via API) |
| OS (decisão) | PCM | PCM cria, atribui, prioriza → Auvo executa |
| Execução em campo | Auvo | GPS, fotos, checklist, assinatura (Auvo exclusivo) |
| Resultado de OS | Auvo → PCM | Webhook status + fotos + checklist + peças consumidas |
| Financeiro | PCM | PCM consolida (dado de execução vem do Auvo) |

## Decisões estruturais (ADRs)
- [ADR-0001 — PCM como origin of truth + externalId idempotente no Auvo](adr/0001-pcm-origin-truth-externalid.md)
- [ADR-0002 — Detecção determinística de menção ao Zé antes do LLM](adr/0002-deteccao-deterministica-ze.md)
