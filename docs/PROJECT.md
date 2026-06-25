---
name: PROJECT
description: Identidade do Sinérgica OS — contexto base de todo agente. Leia em toda sessão.
alwaysApply: true
---

# PROJECT.md — Sinérgica OS

> Status: **casca (Mês 1)** · Início: 2026-06-25 · Desenvolvido por: Trívia Studio

## O que é
Sistema operacional completo da **Sinérgica Manutenções Patrimoniais** (Campinas/SP) — empresa de
manutenção predial que atende condomínios residenciais e comerciais. Centraliza desde a captação
comercial até a execução técnica em campo, faturamento e prestação de contas ao cliente.

O **PCM** (Planejamento e Controle de Manutenção) é o núcleo operacional e o **system of record**
da operação. O **Auvo** é o braço de campo insubstituível (app móvel dos técnicos — check-in GPS,
fotos, checklist, assinatura offline).

## Perfil
**OS (monorepo multi-domínio)** — Padrão OS v2 da Trívia.

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

## Bounded contexts (9 módulos)
| # | Contexto | Feature | Descrição | Schema Postgres |
|---|----------|---------|-----------|-----------------|
| 1 | **PCM / Operação** | `pcm` | Chamados, backlog GUT, visitas, preventivo, inspeções, relatórios diário/mensal, laudos SPDA | `pcm` |
| 2 | **Atendimento (IA/Zé)** | `atendimento` | Agente Zé no WhatsApp — porta única de chamados; fila + detecção determinística | `atendimento` |
| 3 | **Comercial** | `comercial` | CRM, funil de prospects, propostas, contratos mensais | `comercial` |
| 4 | **Financeiro** | `financeiro` | Faturamento, contas a receber, custo por OS, rentabilidade por contrato | `financeiro` |
| 5 | **Operação & Estoque** | `operacao` | Catálogo de materiais, estoque, custo de MO+materiais, Volante | `estoque` |
| 6 | **Marketing** | `marketing` | Conteúdo multicanal, automação de publicações | `marketing` |
| 7 | **Growth** | `growth` | Análise Meta Ads / Google Ads, atribuição de leads | `growth` |
| 8 | **Gestão (Cockpit)** | `gestao` | Dashboards, SLA, produtividade, rentabilidade — views sobre os outros schemas | (views) |
| 9 | **Área do Cliente** | `area-cliente` | Portal do síndico — chamados, relatórios, histórico | (views `pcm`) |

## Papéis de usuário
| Papel | Acesso |
|-------|--------|
| `admin` | Acesso total; configura Agente Zé, integrações, usuários |
| `escritorio` | Operacional — clientes, chamados, backlog, visitas, propostas, relatórios, planos |
| `tecnico` | Restrito — leitura geral + escrita no próprio (OS onde é responsável, inspeções) |
| `cliente-sindico` | WhatsApp (Zé) + Portal (Área do Cliente) — só dados do próprio condomínio |

## Regra de ouro da integração Auvo
**PCM é o origin of truth** para decisões (abertura, prioridade, atribuição).
**Auvo é o origin of truth** para execução (GPS, fotos, checklist, assinatura, peças consumidas).
Identificação cruzada: `id da OS no PCM` → Auvo `externalId` (idempotente); Auvo retorna `auvo_task_id`.

## Ambientes
Ver `docs/ENVIRONMENTS.md`. Novo projeto Supabase dedicado (separado do PCM v2 legado) — provisionado no Mês 2.

## Contrato (síntese)
- Contratada: Trívia Studio (CNPJ 41.429.534/0001-15)
- Contratante: Sinérgica Manutenções (CNPJ 37.502.245/0001-27)
- Valor: R$ 30.000 (case com autorização de divulgação)
- Mês 1: diagnóstico + Blueprint + casca — **em andamento**
- Mês 2: construção (PCM, Comercial, Financeiro, Auvo, Atendimento)
- Mês 3: ativação (Marketing, Growth, Área do Cliente, go-live)

## Contatos
- Product / dono da spec: Fabrício Barbosa Nunes Medeiros (Sinérgica)
- Técnico: Trívia Studio
