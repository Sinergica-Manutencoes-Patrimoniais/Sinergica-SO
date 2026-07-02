---
name: roadmap-epicos
description: Painel mestre de épicos e stories do Sinérgica SO. Leia antes de iniciar qualquer sessão de desenvolvimento.
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
| E00-S03 | Auth bypass dev + Dashboard Geral inicial (9 módulos resumidos) | [spec](../../specs/E00-S03-dashboard-geral/spec.md) | Implementado | Claude (sessão Lucas) | ✅ |
| E00-S04 | Sidebar colapsável + Logo Sinérgica (sidebar e login) | [spec](../../specs/E00-S04-sidebar-logo/spec.md) | Implementado ✅ | Claude (sessão Lucas) | ✅ |
| E00-S05 | Autenticação e Autorização — Supabase Auth real + RBAC (substitui bypass dev) | spec na branch `feat/E00-S05-autenticacao-autorizacao` (ainda não mergeada em `main`) | Código implementado — aguardando validação com Docker/Supabase local + @qa (ver tasks.md) | Claude (sessão Lucas) | ⏳ (código pronto, gates de banco não executados) |
| E00-S06 | Sincronizar correções do Padrão OS v3 / Triviaiox (agente morto, hook de push, gate de arquitetura, CI/deploy) | [spec](../../specs/E00-S06-sync-padrao-os-v3/spec.md) | Implementado (AC-2 bloqueado — aguarda confirmação explícita para ativar hook, ver tasks.md) | Claude (sessão Lucas) | ✅ AC-1,3,4,5 · ⏳ AC-2 |

### E01 — PCM · Operação
| Story ID | Descrição | Spec | Status | Owner | AC verdes |
|----------|-----------|------|--------|-------|-----------|
| E01-S01 | Priorização de backlog por Matriz GUT | [spec](../../specs/0001-priorizacao-backlog-gut/spec.md) | Implementado | Claude (sessão Lucas) | ✅ |
| E01-S02 | Abertura de chamado via Agente Zé | [spec](../../specs/0002-abertura-chamado-ze/spec.md) | Spec aprovada | — | ⏳ |
| E01-S03 | PMOC — Sub-módulo legal: schema, contratos e cronograma automático | — | Planejado (tier arquitetural) | — | — |
| E01-S04 | PMOC — Inventário de equipamentos de climatização (cadastro + wizard) | — | Planejado | — | — |
| E01-S05 | PMOC — Registros de visita, laudo PDF e envio por e-mail | — | Planejado | — | — |
| E01-S06 | PMOC — Análise microbiológica e log de não-conformidades | — | Planejado | — | — |
| E01-S07 | Hub de OS — Fila unificada de Ordens de Serviço (C1/C2/P1/P2/IN, SLA, prioridade) | — | Planejado (tier arquitetural) | — | — |
| E01-S08 | PMOC — Dashboard e telas de gestão de contratos | — | Planejado | — | — |

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
