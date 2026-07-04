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
| E00-S05 | Autenticação e Autorização — Supabase Auth real + RBAC (substitui bypass dev) | [spec](../../specs/E00-S05-autenticacao-autorizacao/spec.md) | **Implementado e em produção** — migrations aplicadas, hook + schemas expostos confirmados via Management API. Só falta login manual no browser (fora do meu alcance) | Claude (sessão Lucas) | ✅ |
| E00-S06 | Sincronizar correções do Padrão OS v3 / Triviaiox (agente morto, hook de push, gate de arquitetura, CI/deploy) | [spec](../../specs/E00-S06-sync-padrao-os-v3/spec.md) | Implementado | Claude (sessão Lucas) | ✅ |
| E00-S07 | Hardening pós-primeira-pipeline-real (Padrão OS v3.2.0→v3.4.0) — Lefthook, Squawk, revisão adversarial | [spec](../../specs/E00-S07-hardening-padrao-v3.2.0/spec.md) | **Implementado e mergeado** (PR [#7](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/7)) | Claude (sessão Lucas) | ✅ (2 SPEC_DEVIATION: skill `/revisao-adversarial` e regexes extra do gitleaks bloqueados pelo classificador — ver tasks.md) |
| E00-S08 | Renomear papéis RBAC — admin/escritorio/tecnico → superadmin/supervisor/colaborador (mesma matriz de permissão) + provisiona primeiro superadmin | [spec](../../specs/E00-S08-renomear-papeis-rbac/spec.md) | **Implementado e mergeado** (PR [#8](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/8)) — `sinergicaengenharia@gmail.com` já é `superadmin` em produção | Claude (sessão Lucas) | ✅ |
| E00-S09 | Grupos e permissões por módulo — fundação: schema, resolver, hook JWT, Edge Function de gestão de usuário | [spec](../../specs/E00-S09-grupos-permissao-modulo/spec.md) · [design](../../specs/E00-S09-grupos-permissao-modulo/design.md) | **PR [#9](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/9) aberto** — `db-tests` (pgTAP) achou e corrigiu 2 bugs reais no CI (`to_jsonb(NULL)` no hook, guarda `session_user` não sobrevive a `SET LOCAL ROLE`); gates de código verdes | Claude (sessão Lucas) | ⏳ |
| E00-S10 | Grupos e permissões por módulo — UI administrativa (grupos, usuários) e gating de sidebar | [spec](../../specs/E00-S10-grupos-permissao-ui/spec.md) | **PR [#9](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/9) aberto** (bundle com E00-S09) — `lint`/`typecheck`/`test` (75 verdes)/`build`/`arch:check` verdes; teste manual em browser pendente | Claude (sessão Lucas) | ⏳ |

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
| E01-S09 | Integração Auvo — Fundação: cliente HTTP, sync de clientes, criação de task ao entrar em `planejamento` | [spec](../../specs/E01-S09-integracao-auvo-fundacao/spec.md) · [design](../../specs/E01-S09-integracao-auvo-fundacao/design.md) · [tasks](../../specs/E01-S09-integracao-auvo-fundacao/tasks.md) | **Implementado e mergeado** (PR [#10](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/10)) — gates Node verdes + `db-tests` real no CI; Edge Functions (Deno) não puderam ser type-checked localmente (sem Deno CLI); 6 SPEC_DEVIATION abertos, ver tasks.md | Claude (sessão Lucas) | ✅ |
| E01-S10 | Integração Auvo — Webhook de status/conclusão de OS (+ gatilho `pcm.pmoc_records`) | [spec](../../specs/E01-S10-integracao-auvo-webhook-status/spec.md) · [tasks](../../specs/E01-S10-integracao-auvo-webhook-status/tasks.md) | **Implementado e mergeado** (PR [#11](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/11)) — AC-1 a AC-6 (`pcm-auvo-webhook` + `_shared/auvo/verify-signature.ts`); AC-7 deferido (SPEC_DEVIATION — `pcm.pmoc_records` não existe, PMOC ainda não construído); mapeamento de "Cancelada" também é SPEC_DEVIATION (inferido, sem `taskStatus` documentado); gates Node verdes, sem Deno CLI para type-check/testes de integração | Claude (sessão Lucas) | ✅ (AC-1–6; AC-7 deferido) |
| E01-S11 | Integração Auvo — Sync de técnicos/equipes/equipamentos (Auvo → PCM, cache read-only) | [spec](../../specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/spec.md) · [tasks](../../specs/E01-S11-integracao-auvo-sync-tecnicos-equipamentos/tasks.md) | **Implementado e mergeado** (PR [#12](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/12)) — migrations `0012` (cache `pcm.tecnicos_cache`/`pcm.equipamentos_cache` + RLS FORCE + `grant usage on schema pcm to service_role` que faltava) e `0013` (pg_cron diário 06:00 UTC, reusa secrets do Vault de `0011`); Edge Functions `pcm-auvo-users-sync`/`pcm-auvo-equipment-sync` + `_shared/auvo/paginate.ts` + pgTAP RLS. `@qa` achou 1 bug real no pgTAP (UPDATE/DELETE sem `throws_ok`, `db-tests` teria falhado) — corrigido por `@dev`, `db-tests` verde na CI antes do merge. Task 8 (habilitar `pg_cron` no Dashboard Supabase) é pendência operacional manual. | Claude (sessão Lucas) | ✅ |
| E01-S12 | Visão 360 do Cliente — página read-only por condomínio (v1: cadastro + backlog GUT + histórico de OS; +técnicos/equipamentos se E01-S11 fechar). PMOC/ativos/financeiro/WhatsApp adiados p/ fase 2 | [product](../../specs/E01-S12-visao-360-cliente/product.md) · [spec](../../specs/E01-S12-visao-360-cliente/spec.md) · [tasks](../../specs/E01-S12-visao-360-cliente/tasks.md) | **Implementado e mergeado** (PR [#14](https://github.com/Sinergica-Manutencoes-Patrimoniais/Sinergica-SO/pull/14)). Tasks 1-20 feitas (domain+application+infrastructure+5 componentes+página+lista de navegação, hexagonal em `features/pcm/`); AC-1 a AC-8 cobertas (unit verde; AC-1/AC-7 por revisão de código; **AC-6 caminho real PGRST205 pendente do CI `db-tests`** — sem Docker local). Gates locais verdes: lint, typecheck, test (93 pass/9 skip), build, `audit:esteira`, `eval:spec`. **0 SPEC_DEVIATION.** **Revisão @qa: CONCERNS → achado C1 (média) corrigido** — `obter-visao-cliente` isola a falha do painel de equipamentos (qualquer erro, não só PGRST205) para não derrubar cabeçalho/backlog/histórico junto (AC-6 real); +2 testes. **Task 18 (navegação) FEITA — OPEN-QUESTION #3 resolvida pelo PO (Lucas): lista mínima de clientes no mesmo PR** (`ListaClientesPage` em `features/pcm/pages/` + `listarClientes` no gateway/adapter existente + wiring `useState` `pcmView`/`clienteSelecionado` na `HomePage`, sem lib de rotas; gate `podeAcessar('pcm','leitura')` + RLS já existente, sem permissão nova). Pendência restante: assunção de acoplamento do nome de coluna de `equipamentos_cache` — reconciliada, E01-S11 já mergeada (PR #12). Falta validação humana em browser | Claude (sessão Lucas) | ✅ (AC-1–8 + nav. Task 18) |
| | **QA gate (@qa Quinn, 2026-07-03): CONCERNS → resolvido.** Revisão adversarial linha a linha do diff `a3a9e0b` + gates reexecutados no worktree (lint, typecheck, test 88/9skip, build, `audit:esteira` 124 OK — todos verdes). AC-1 a AC-8 implementadas corretamente nos caminhos existentes; **read-only confirmado** (zero `insert/update/delete/upsert/rpc`; único `onClick` é "Tentar novamente" = re-leitura). O fallback perigoso (mascarar erro real como "indisponível") **NÃO ocorre** — o adapter só degrada em `PGRST205`/`42P01` e **relança** qualquer outro erro. **(C1, MÉDIA) → CORRIGIDO por @dev:** erro inesperado da query de equipamentos agora é isolado (`carregarEquipamentos` com try/catch), não derruba mais o resto da página. **(C2, BAIXA-MÉDIA)** caminho real PGRST205 não verificado empiricamente nesta build (sem Docker) — validar no CI `db-tests` antes do merge final. **(C3, produto) → RESOLVIDO:** navegação (Task 18) implementada por decisão do PO. | @qa (Quinn) | ✅ |
| E01-S13 | Import inicial de clientes Auvo → PCM (bootstrap, direção invertida do fluxo padrão PCM→Auvo de E01-S09) — popula `pcm.clientes`/`auvo_id` a partir da base já cadastrada no Auvo em produção | [spec](../../specs/E01-S13-import-inicial-clientes-auvo/spec.md) · [tasks](../../specs/E01-S13-import-inicial-clientes-auvo/tasks.md) | **Implementado** — migration `0014` (GRANT service_role em `pcm.clientes`, faltava desde sempre) + `0015` (pg_cron diário, reusa secrets de `0011`/`0013`); Edge Function `pcm-auvo-customers-import` (paginação + upsert por `auvo_id` + soft-delete guardado, mesmo padrão de `E01-S11`). Gates Node verdes (lint:migrations 15 migrations, audit-esteira 126 docs, lint, typecheck, test 93 pass, build). Sem Deno CLI/Docker aqui → Edge Function não type-checada/testada (mesma ressalva de E01-S09/S10/S11); nenhum teste Deno dedicado escrito (gap real, sinalizado). Pendências operacionais: habilitar `pg_cron` (se ainda não estiver de E01-S11), chamada manual pós-deploy pra popular a base pela primeira vez. Sem push ainda | Claude (sessão Lucas) | ⏳ |

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
