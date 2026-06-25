---
name: roadmap-epicos
description: Painel mestre de épicos e stories do Sinérgica OS. Leia antes de iniciar qualquer sessão de desenvolvimento.
alwaysApply: true
---

# Roadmap — Épicos e Stories

> **Leia antes de começar.** Este é o painel de controle do trabalho em andamento.
> Múltiplas pessoas/sessões Claude podem estar em paralelo — marque o `owner` da story antes de implementar.
> Processo obrigatório: `@pm/@analyst` abre story → `@architect` (se tier arquitetural) → `@sm` quebra em tasks → `@dev` implementa → `@qa` valida → `@devops` faz merge/push.

## Épicos

| ID | Módulo / Contexto | Status | Owner atual |
|----|-------------------|--------|-------------|
| E00 | Shell & Infra (autenticação, layout, deploy) | Em andamento | — |
| E01 | PCM · Operação | Planejado | — |
| E02 | Atendimento · Zé | Planejado | — |
| E03 | Comercial | Planejado | — |
| E04 | Financeiro | Planejado | — |
| E05 | Operação · Estoque | Planejado | — |
| E06 | Marketing | Planejado | — |
| E07 | Growth | Planejado | — |
| E08 | Gestão · Cockpit | Planejado | — |
| E09 | Área do Cliente | Planejado | — |

## Stories por épico

### E00 — Shell & Infra
| Story ID | Descrição | Spec | Status | Owner | AC verdes |
|----------|-----------|------|--------|-------|-----------|
| E00-S00 | Schemas de domínio — migration base (9 contextos, RLS FORCE, audit) | — | Implementado (casca) | Claude (sessão Lucas) | ✅ |
| E00-S01 | Tela de login + Home com cards dos módulos | [spec](../../specs/E00-S01-login-home/spec.md) | Implementado | Claude (sessão Lucas) | ✅ |
| E00-S02 | Redesign home — sidebar + abas por módulo + dashboard PCM | [spec](../../specs/E00-S02-home-dashboard/spec.md) | Implementado (SPEC_DEVIATION) | Claude (sessão Lucas) | ✅ |

### E01 — PCM · Operação
| Story ID | Descrição | Spec | Status | Owner | AC verdes |
|----------|-----------|------|--------|-------|-----------|
| E01-S01 | Priorização de backlog por Matriz GUT | [spec](../../specs/0001-priorizacao-backlog-gut/spec.md) | Implementado | Claude (sessão Lucas) | ✅ |
| E01-S02 | Abertura de chamado via Agente Zé | [spec](../../specs/0002-abertura-chamado-ze/spec.md) | Spec aprovada | — | ⏳ |

### E02 — Atendimento · Zé
*Stories serão abertas quando E01-S02 iniciar (dependência de design).*

### E03 — Comercial
*Aguarda diagnóstico do mês 1.*

### E04 — Financeiro
*Aguarda diagnóstico do mês 1.*

### E05 — Operação · Estoque
*Aguarda diagnóstico do mês 1.*

### E06 — Marketing
*Aguarda diagnóstico do mês 1.*

### E07 — Growth
*Aguarda diagnóstico do mês 1.*

### E08 — Gestão · Cockpit
*Aguarda diagnóstico do mês 1.*

### E09 — Área do Cliente
*Aguarda diagnóstico do mês 1.*

## Como abrir uma nova story

1. **Atualize esta tabela** — escreva o Story ID (E0N-S0N), descrição e marque o owner (seu nome/sessão).
2. **Crie o diretório** `specs/E0N-S0N-<nome>/` com pelo menos `spec.md` e `tasks.md` antes de codar.
3. **Use o agente correto** — `/pm` ou `/analyst` para escopo, `/architect` para design, `/sm` para tasks, `/dev` para implementar.
4. **Ao concluir** — marque AC verdes nesta tabela e atualize `docs/STATE.md`.

## Como evitar conflito entre sessões paralelas

- Se o owner de uma story estiver em branco → você pode pegar.
- Se estiver preenchido → **não toque** nessa story; escolha outra.
- Regra de ouro: **uma story, um owner por vez.**
