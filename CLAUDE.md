---
name: CLAUDE
description: Convenções do agente para o Sinérgica SO (fluxo enxuto E00-S25). Sempre ativo.
alwaysApply: true
---

# CLAUDE.md — Sinérgica SO

> Cliente: Sinérgica Manutenções (manutenção predial) · Monorepo multi-domínio · Trívia Studio.
> Idioma: **PT-BR com termos técnicos em inglês**. Fonte de verdade lida em runtime (o vault Obsidian é espelho).

## Contexto
- **9 bounded contexts:** PCM/Operação, Comercial, Atendimento (IA/Zé), Marketing, Growth, Financeiro, Gestão (cockpit), Área do Cliente — `docs/ARCHITECTURE.md`.
- **Stack:** React 19 + Vite + TS + Tailwind; Supabase (Postgres, Edge Functions, Storage); Netlify; OpenRouter (LLM); Auvo (campo); Evolution API (WhatsApp).
- **PCM é o system of record**; Auvo é o braço de campo.
- **Papéis:** superadmin · supervisor · colaborador · cliente-síndico.

## Início de sessão (carregue só isto)
`CLAUDE.md` · `docs/STATE.md` · **a linha da sua story** no ROADMAP (`grep -n "E0N-S0N" docs/epics/ROADMAP.md`) · `spec.md` da story ativa.
**Nunca leia o `ROADMAP.md` inteiro** (histórico completo em `docs/epics/historico/`). O resto é sob demanda (mapa no fim).

## Fluxo de trabalho (várias sessões em paralelo)
1. **Escolha/abra a story** no `docs/epics/ROADMAP.md` (próximo ID = "maior ID usado" do épico + 1) e **marque o owner antes de codar**. Uma story, um owner.
2. **Trivial / bug** (≤3 arquivos, sem decisão): branch → teste que falha → fix → PR. Sem spec.
3. **Feature:** `speckit-specify` → `speckit-plan` → `speckit-tasks` → `speckit-implement`, em `specs/E0N-S0N-<nome>/`.
   `tasks.md` = 1 linha por task + AC; detalhe técnico (SQL, assinaturas) vai no `plan.md`.
4. **Arquitetural** (novo bounded context, integração externa, schema com dado em produção, decisão irreversível): além do fluxo de feature, ADR em `docs/adr/` **antes** de implementar e `/revisao-adversarial` antes do PASS.
5. **Ao concluir:** tire a linha do ROADMAP (a story fica no git e no `spec.md`); `docs/STATE.md` só via `/handoff` ao pausar.
- Personas Triviaiox (`@architect`, `@security`, `@data-engineer`…) são **opcionais**: `AGENTS.md`.
- **Spec ambígua? Pare e pergunte.** "Fora de escopo" é vinculante. Não invente: codebase → docs → MCP/doc oficial → "não sei".

## Convenções de rastreio (obrigatório)
- **Commit:** `feat(E01-S02): …` · `fix(E03-S01): …` · `chore(E00-S25): …` (ID da story no escopo).
- **Migration:** `NNNN_E0N-S0N_descricao.sql`, sequência sem pular (ver `db/README.md`).
- **Branch:** `feat/E0N-S0N-descricao`. **Nunca `git push origin main`**: branch → push da branch → PR (`gh pr create`) → merge após aprovação. Só `@devops`/humano faz push (o `git push` pede confirmação).
- Termos exatos de `docs/glossary.md`; termo novo entra no glossário no mesmo PR. Sem sinônimos.

## Arquitetura — DDD tático por feature
`interfaces → application → domain ← infrastructure`, dentro de `apps/web/src/features/<dominio>/`.
`domain/` sem I/O nem framework · `application/` casos de uso · `infrastructure/` adapters (Supabase, Auvo, Evolution).
Features de domínios diferentes **não se importam**: compartilhe via `packages/`.

## Data fetching — TanStack Query (obrigatório em código novo)
Todo dado de servidor passa por TanStack Query, nunca `useState`+`useEffect`+`carregar()`.
- Hooks em `application/<dominio>-queries.ts` com chaves em `<dominio>QueryKeys` (padrão: `features/pcm/application/operacao-queries.ts`).
- `queryClient` único em `app/query-client.ts` (`staleTime` 30s). Após escrever, **invalide a chave**.
- Filtro/busca: `keepPreviousData` + cancelamento (resultado antigo nunca sobrescreve filtro novo).
- `useState` só para estado local de UI. Tela antiga converte quando for tocada; `useEffect` buscando dado de servidor em código novo é recusado no review.

## Segurança — OS-grade (não negociável)
RLS **FORCE** em toda tabela + teste pgTAP (permitido e negado) · schemas por domínio · `audit.*` append-only · secrets e refresh OAuth no Vault · webhooks com HMAC · `service_role` nunca no client · permissão checada no servidor. Migration só aditiva; nunca edite migration aplicada.
Detalhes: `seguranca/os-grade.md`. Toda dívida → `docs/SECURITY_DEBT.md`.

## Divergência da spec (SPEC_DEVIATION)
Pare → marque `// SPEC_DEVIATION: <motivo>` no código e em `tasks.md` → corrija o código **ou** atualize a spec + ADR. Nunca silencioso.

## Definition of Done
`Definition-of-Done.md`. Resumo: AC verdes **por comando** · CI verde no PR (`gh pr checks`, incluindo `db-tests` **não pulado**) · sem SPEC_DEVIATION pendente · ADR se irreversível · glossário atualizado.
Gate verde é "caminho feliz funciona": no tier arquitetural, rode `/revisao-adversarial` (achado reproduzido vira teste).
Pre-push roda só o que mudou; `pnpm run ci:local` (completo) sob demanda antes de PR sensível.

## Mapa de docs (sob demanda)
`docs/PROJECT.md` identidade · `docs/ARCHITECTURE.md` contextos · `docs/blueprint/` requisitos · `docs/glossary.md` · `db/README.md`, `db/rls.template.sql` · `seguranca/` · `docs/adr/` (nunca edite ADR; crie outro que o substitua) · `supabase/functions/_template/` · `observabilidade/`, `runbooks/` · `ia/` (features com LLM) · `specs/_examples/` · helpers: `apps/web/src/lib/log.ts`, `lib/http/problem.ts`, `config/env.ts`.

## graphify
`graphify-out/graph.json` existe. Para pergunta de código: `graphify query "<pergunta>"` (ou `path`/`explain`) antes de grep bruto. Após alterar código: `graphify update .`.
