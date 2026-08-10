---
name: tasks
description: Decomposição e gates — fundação do módulo Comercial (schema do funil + view de Contas + Lista de Contas + aba na Visão 360).
alwaysApply: false
---

# Tasks — E03-S01 · Fundação do Comercial + Conta única

> Antes de codar: marcar owner no `docs/epics/ROADMAP.md` (seção E03). Ler `spec.md` (AC),
> `design.md` (contrato de colunas/RLS/fronteiras) e `product.md` (visão do épico).
> Branch: `feat/E03-S01-fundacao-comercial` — **nunca** push direto na `main`.
> Migrations: a próxima sequência livre é **`0173`** (última aplicada: `0172`).

## Plano

| # | Task | Cobre AC | Depende de | Gate (comando) | Status |
|---|------|----------|------------|----------------|--------|
| 1 | Migration `0173_E03-S01_fundacao_comercial.sql`: `grant usage` no schema `comercial`, 4 tabelas (`etapas_funil`, `motivos_perda`, `oportunidades`, `oportunidade_eventos` — contrato em `design.md` §2.1, inclui `lead_tier`/`cluster_nome`), RLS FORCE + policies leitura/escrita por `user_modulos.comercial` + bypass superadmin, colunas de auditoria, seed das 6 etapas e dos motivos de perda | AC-1, AC-2 | — | `pnpm run lint:migrations` | todo |
| 2 | Migration `0174_E03-S01_trigger_motivo_perda.sql`: trigger `BEFORE INSERT/UPDATE` em `oportunidades` que rejeita entrada em etapa `tipo='perdida'` sem `motivo_perda_id` e preenche `fechada_em` ao fechar (`ganha`/`perdida`), limpando ao reabrir | AC-6 | 1 | `pnpm run lint:migrations` | todo |
| 3 | Migration `0175_E03-S01_view_contas_e_depreciacao.sql`: view `relacionamento.contas` (`security_invoker=true` — herda a RLS de `pcm.clientes`, **não** expõe `tipo`/`status_comercial`) + `grant select` + `comment on column` de depreciação em `pcm.clientes.tipo` e `status_comercial` citando ADR-0020. **Não dropar nada** | AC-3, AC-8 | — | `pnpm run lint:migrations` | todo |
| 4 | Expor schema `comercial` no PostgREST: `db.schemas` em `supabase/config.toml` + nota de deploy (o `config.toml` sozinho **não** propaga — exige `PATCH .../postgrest` via Management API, mesmo passo manual da E00-S05 e da E04-S01) | AC-1 | 1 | manual (config) — conferir com `curl` ao schema em produção | todo |
| 5 | `domain/funil.ts`: tipos `Etapa`/`Oportunidade`, transição de etapa (quais transições são válidas, quando exige motivo, quando preenche/limpa `fechada_em`), `etapaPadrao()` (primeira `aberta`) — funções puras, sem I/O — com unit tests dos casos de borda da spec (reabrir, mover para `ganha`, etapa desativada) | AC-4, AC-5, AC-6 | — | `pnpm run test` | todo |
| 6 | `application/comercial-gateway.ts` (porta) + casos de uso (listar Contas com etapa, criar oportunidade, mover etapa, listar oportunidades por Conta, CRUD de etapas/motivos) · `infrastructure/supabase-comercial-adapter.ts` (supabase-js sob RLS; lê Conta **pela view** `relacionamento.contas`, nunca `pcm.clientes` direto — R2 do ADR-0019) | AC-3, AC-4, AC-5, AC-7 | 5 | `pnpm run test` | todo |
| 7 | `ContasPage` (Lista de Contas): todas as Contas **sem filtro implícito de `ativo`**, coluna de etapa do funil, filtros por etapa/situação/texto, estado vazio honesto para Conta sem oportunidade. Padrão visual das páginas PCM (`ListaClientesPage` como referência) | AC-7 | 6 | `pnpm run test` | todo |
| 8 | Aba **Comercial** na Visão 360 (`VisaoClientePage`): lista oportunidades da Conta (etapa, valor, responsável, score) + criar oportunidade. **Não alterar as abas existentes** — só acrescentar | AC-9 | 6 | `pnpm run test` | todo |
| 9 | Configuração do funil: CRUD de `etapas_funil` (nome, ordem, cor, tipo) e `motivos_perda`; desativar em vez de excluir quando houver oportunidade (FK) | AC-2 | 6 | `pnpm run test` | todo |
| 10 | Navegação: grupo COMERCIAL na sidebar (`HomePage.tsx`), gate `podeAcessar('comercial', ...)`; modo somente-leitura sem `escrita` (sem botões de criar/mover) | AC-10 | 7, 8, 9 | `pnpm run test` | todo |
| 11 | pgTAP `supabase/tests/comercial_fundacao_rls.test.sql`: RLS das 4 tabelas nos 4 perfis (sem módulo / leitura / escrita / superadmin), trigger de motivo de perda (rejeita sem motivo, aceita com), e a view respeitando RLS de `pcm.clientes` | AC-1, AC-3, AC-6 | 1, 2, 3 | CI `db-tests` | todo |
| 12 | **Reconferir produção antes de fechar**: reexecutar as contagens do `design.md` §4 (`comercial.leads`, `tipo='lead'`, `status_comercial='prospecto'`, vínculos `comercial_lead`) e confirmar que continuam **zeradas**. Se alguém tiver rodado o UAT do agente no meio do caminho, o plano de 5 passos do histórico volta a valer e esta story muda de escopo | AC-8 | 1–11 | `supabase db query --linked` (read-only) | todo |
| 13 | `pnpm run ci:local` + Playwright contra **dev server local** (nunca a URL do Netlify): criar Conta→oportunidade→mover etapa→tentar mover para Perdido sem motivo (deve barrar)→com motivo (deve fechar) + atualizar ROADMAP/STATE + glossário conferido | todos | 1–12 | `pnpm run ci:local` | todo |

> Uma task só vira `done` quando o **gate passa** — não por inspeção visual.

## Plano de teste

- **Unit (domínio)**: transições de etapa válidas/inválidas; exigência de motivo só em `perdida`;
  `fechada_em` preenchido ao fechar e limpo ao reabrir; `etapaPadrao()` com lista sem nenhuma
  etapa `aberta` (erro explícito, não `undefined`).
- **pgTAP**: RLS das 4 tabelas nos 4 perfis; trigger de motivo de perda nos dois sentidos; view
  `relacionamento.contas` devolvendo zero linhas para quem não tem `pcm` nem `comercial`.
- **Playwright** (dev server local): fluxo completo criar→mover→bloqueio de perda sem motivo→
  fechar com motivo; Lista de Contas exibindo Conta **inativa** (prova do AC-7, que é o que
  diferencia do PCM); aba Comercial na Visão 360 sem quebrar as abas existentes.

## Riscos desta story

| Risco | Mitigação |
|-------|-----------|
| `comercial.leads` está vazia mas **viva** — `pcm-ze-agent` deployado insere nela | Fora de escopo dropar (spec). As duas convivem até S09/S10. Task 12 reconfere |
| View sem `security_invoker` vazaria Conta para quem não tem RLS de `pcm.clientes` | Explícito na task 3 + pgTAP na task 11. Lembrete: view **não herda grant da tabela** (bug real da E04-S04, migration `0110`) |
| Schema novo não propaga no PostgREST só com `config.toml` | Task 4 com o passo manual da Management API, já documentado em E00-S05/E04-S01 |
| Aba nova quebrar a Visão 360 existente | Task 8 só acrescenta; Playwright confere as abas antigas |

## Divergências (SPEC_DEVIATION)
- [ ] Nenhuma divergência aberta.

## Checklist de Definition of Done
- [ ] Todos os AC verdes **pelo gate executável**
- [ ] `pnpm run ci:local` verde (sem check obrigatório pulado; `db-tests` exige Docker/CI)
- [ ] Playwright rodado contra dev server local antes de reportar pronto
- [ ] Revisão adversarial feita (`/revisao-adversarial`) — borda: etapa desativada com
      oportunidade dentro? reabrir fechada? Conta sem oportunidade?
- [ ] Nenhum `SPEC_DEVIATION` pendente
- [ ] ADR-0019/ADR-0020 refletidos no que foi construído
- [ ] `docs/epics/ROADMAP.md`, `docs/STATE.md` e glossário atualizados
