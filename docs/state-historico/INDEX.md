---
name: state-historico-index
description: Índice do histórico arquivado de docs/STATE.md — 1 linha por período, para achar rápido sem ler tudo.
alwaysApply: false
---

# Índice — histórico do STATE.md

> `docs/STATE.md` guarda só a sessão mais recente + bloqueios abertos. Tudo antes disso vive aqui,
> arquivado por período, cronológico reverso preservado. Rotação feita em 2026-07-13 (o arquivo
> tinha crescido pra 1860 linhas, `alwaysApply: true`, carregado em toda sessão — ver
> `.claude/skills/handoff/SKILL.md` para a regra de rotação daqui pra frente).

| Período | Arquivo | O que tem |
|---------|---------|-----------|
| 2026-08-18 | [2026-08-18.md](2026-08-18.md) | E00-S24 (`/impeccable` — DESIGN.md/PRODUCT.md de `apps/web` + polish Início/Dashboard PCM); lote visual E00-S14..S23 parte 2 (migração mecânica S17/S18, verificação S19/S22, S20/S21/S23 pulados por decisão do Lucas). |
| 2026-07-21 a 2026-08-11 | [2026-07-21-a-2026-08-11.md](2026-07-21-a-2026-08-11.md) | E09 Portal do Cliente (fundação); lotes de PCM/Chamados/OS (E01-S91–S145, unificação Chamado↔OS, cockpit, dashboard, PDFs); E02 Atendimento/Evolution (multi-instância, Auvo import); limpeza de dados `[TESTE E2E]` em produção; E03 Comercial especificado e implementado por completo (S01–S14, PR #57 mergeado). |
| 2026-07-15 a 2026-07-18 | [2026-07-15-a-2026-07-18.md](2026-07-15-a-2026-07-18.md) | E01-S75 (refinamento UX do PCM); E01-S76 (hierarquia de localização de ativos + Sistemas, tier arquitetural); E01-S77 (apontamento de horas visão diária); E01-S78 (Board de ativos por Local + drawer de detalhe). |
| 2026-07-04 a 2026-07-11 | [2026-07-04-a-2026-07-11.md](2026-07-04-a-2026-07-11.md) | Motor de sync Auvo genérico (write+read path, E01-S22/S23) e catálogo de ~13 entidades (E01-S24–S33); épico Atendimento/E02 inteiro (Inbox rico, IA, canais Meta/Evolution, growth/scoring, fluxos node-graph); backfill real de 2364 OS em produção; bugs de produção corrigidos (campo `taskID`, arrays vazios no upsert, timeout do sync); acabamento visual V1 (E01-S59/S60); Kanban drag-and-drop (E01-S61). |
| 2026-06-25 a 2026-07-03 | [2026-06-25-a-2026-07-03-fundacao.md](2026-06-25-a-2026-07-03-fundacao.md) | Fundação do projeto — schemas de domínio, autenticação/RBAC real (E00-S05), grupos e permissões por módulo (E00-S09/S10), fundação da integração Auvo (E01-S09/S10/S11), Padrão OS v3.2→v3.4 (Lefthook, Squawk), provisionamento do Supabase e GitHub Actions em produção. Formato antigo (seções fixas, não entradas por sessão) — vários "Bloqueios" já resolvidos no próprio texto. |

## Como buscar
`grep -rn "termo" docs/state-historico/` acha rápido sem abrir cada arquivo. Cada arquivo é
`alwaysApply: false` — só entra no contexto se puxado explicitamente (`/handoff`, ou pedindo pra
ler), nunca no carregamento automático de sessão.
