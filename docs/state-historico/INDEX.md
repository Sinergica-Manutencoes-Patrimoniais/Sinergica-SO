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
| 2026-07-04 a 2026-07-11 | [2026-07-04-a-2026-07-11.md](2026-07-04-a-2026-07-11.md) | Motor de sync Auvo genérico (write+read path, E01-S22/S23) e catálogo de ~13 entidades (E01-S24–S33); épico Atendimento/E02 inteiro (Inbox rico, IA, canais Meta/Evolution, growth/scoring, fluxos node-graph); backfill real de 2364 OS em produção; bugs de produção corrigidos (campo `taskID`, arrays vazios no upsert, timeout do sync); acabamento visual V1 (E01-S59/S60); Kanban drag-and-drop (E01-S61). |
| 2026-06-25 a 2026-07-03 | [2026-06-25-a-2026-07-03-fundacao.md](2026-06-25-a-2026-07-03-fundacao.md) | Fundação do projeto — schemas de domínio, autenticação/RBAC real (E00-S05), grupos e permissões por módulo (E00-S09/S10), fundação da integração Auvo (E01-S09/S10/S11), Padrão OS v3.2→v3.4 (Lefthook, Squawk), provisionamento do Supabase e GitHub Actions em produção. Formato antigo (seções fixas, não entradas por sessão) — vários "Bloqueios" já resolvidos no próprio texto. |

## Como buscar
`grep -rn "termo" docs/state-historico/` acha rápido sem abrir cada arquivo. Cada arquivo é
`alwaysApply: false` — só entra no contexto se puxado explicitamente (`/handoff`, ou pedindo pra
ler), nunca no carregamento automático de sessão.
