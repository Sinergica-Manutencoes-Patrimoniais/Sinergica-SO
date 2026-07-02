---
name: CLAUDE
description: Convenções do agente para o Sinérgica SO (Padrão SO v2 + Triviaiox). Sempre ativo.
alwaysApply: true
---

# CLAUDE.md — Sinérgica SO

> Projeto: **Sinérgica SO** · Cliente: Sinérgica Manutenções · Perfil: **SO (monorepo multi-domínio)**
> Desenvolvido pela Trívia Studio seguindo o **Padrão SO v2** (SDD + Triviaiox).
> Idioma: **PT-BR com termos técnicos em inglês** (spec, AC, bounded context, gate, ADR, RLS, etc.).

Leia este arquivo antes de qualquer implementação. **É a fonte de verdade que o agente lê em
runtime** — o vault Obsidian é só espelho humano.

## Contexto do projeto
- **O que é:** sistema operacional da empresa Sinérgica Manutenções (manutenção predial).
- **Módulos (9 bounded contexts):** PCM/Operação, Comercial, Atendimento (IA/Zé), Marketing,
  Growth, Financeiro, Gestão (cockpit), Área do Cliente — ver `docs/ARCHITECTURE.md`.
- **Stack:** React 19 + Vite + TypeScript + Tailwind; Supabase (Postgres + Edge Functions + Storage);
  Netlify; OpenRouter (LLM); Auvo (campo); Evolution API (WhatsApp).
- **PCM é o system of record**; Auvo é o braço de campo (execução insubstituível).
- **Papéis:** admin · escritorio · tecnico · cliente-síndico.

## Regras aprendidas em sessões anteriores (leia sempre)

@.claude/memory/feedback-processo-stories.md
@.claude/memory/feedback-devops-branch-pr.md

## Início de sessão — contexto base obrigatório (`alwaysApply: true`)
Carregue **antes da primeira tarefa**:
este `CLAUDE.md` · `docs/STATE.md` · `docs/epics/ROADMAP.md` · `docs/PROJECT.md` · `spec.md` da feature ativa em `specs/`.

Todos os outros docs são `alwaysApply: false` — puxe **sob demanda** pelo `description` no frontmatter.

## Processo de trabalho por story (OBRIGATÓRIO — trabalho paralelo)
O desenvolvimento é feito por **múltiplas pessoas/sessões Claude simultaneamente**.
Cada sessão pode estar em um épico diferente. Para não haver conflito:

1. **Leia `docs/epics/ROADMAP.md` ao iniciar.** Veja qual story está disponível (sem owner).
2. **Marque o owner** da story nessa tabela antes de codar qualquer linha.
3. **Siga o ciclo de agentes Triviaiox** (`AGENTS.md`):
   - `@pm` / `@analyst` → define/refina o escopo da story e escreve `product.md`
   - `@architect` → (se tier arquitetural) escreve `design.md`
   - `@sm` → quebra em tasks (`tasks.md`) com referência de AC
   - `@dev` → implementa (somente após tasks.md existir)
   - `@qa` → valida ACs contra os gates
   - `@devops` → merge, commit, push
4. **Nunca implemente sem `spec.md` e `tasks.md` existirem.** Se não existirem, crie-os primeiro.
5. **Ao concluir**, atualize `docs/epics/ROADMAP.md` (status, AC verdes) e `docs/STATE.md`.

## Convenções de nomeação — rastreio épico/story (OBRIGATÓRIO)

### Commits
Sempre incluir o ID da story no escopo do Conventional Commit:
```
feat(E01-S02): descrição do que foi feito
fix(E03-S01): descrição do fix
chore(E00-S00): descrição da tarefa de infra
```

### Migrations
Formato: `NNNN_E0N-S0N_descricao.sql`
- `NNNN` = sequência crescente (garante ordem de execução no Supabase)
- `E0N-S0N` = ID do épico + story que criou esta migration
- Exemplo: `0002_E01-S02_tabela_ordens_servico.sql`

A sequência nunca pula: se a última é `0001`, a próxima é `0002`.
Ver `db/README.md` para detalhes.

## A spec é a fonte da verdade
- Implemente **a partir de** `specs/NNNN-*/spec.md`. Os AC (Given/When/Then) são o contrato e
  o oráculo de teste.
- Spec ambígua? **Pare e pergunte.** Nunca adivinhe. Atualizar a spec é decisão consciente.
- **"Fora de escopo" é vinculante.**

## Verificação de conhecimento (nunca invente)
1. Padrões do próprio codebase.
2. Docs do projeto (`specs/`, `docs/`, ADRs, glossário).
3. MCP de referência (Supabase, Context7) quando conectado.
4. Web/doc oficial da tecnologia.
5. Não encontrou? **Diga "não sei" e sinalize.** Incerteza explícita > chute confiante.

## Antes de codar — descubra o tier
*Isso introduz decisão difícil de reverter ou nova fronteira de domínio?*
- **Trivial** (≤3 arquivos, sem decisão): só o PR (ou `specs/quick/`).
- **Pequeno** (feature isolada, <10 tasks): `spec.md` + `tasks.md`.
- **Arquitetural** (novo bounded context, integração externa, decisão irreversível, schema com dados em
  produção): `design.md` aprovado **antes** de implementar. Sem ele → pare e sinalize.

> Se os passos passarem de ~5 ou surgirem dependências complexas → crie `tasks.md` formal.
> Leia `ANTI-PADROES.md` antes de criar qualquer artefato.

## Quem faz o quê — agentes Triviaiox
`AGENTS.md` tem o ciclo completo. Resumo:
`@pm/@analyst` → `@architect` → `@sm` → `@dev` → `@qa` → `@devops` (único com git push/PR).
Feature com LLM → `@prompt-engineer` (ver `ia/`).

Agentes disponíveis: `.claude/commands/TRIVIAIOX/agents/` · `.codex/agents/`.

## Linguagem ubíqua
Use exatamente os termos de `docs/glossary.md` e do `domain.md` da feature. Termo novo → glossário
no mesmo PR. **Sem sinônimos.**

## Arquitetura — regra de dependência (DDD tático por feature)
```
interfaces → application → domain ← infrastructure
```
Dentro de `apps/web/src/features/<dominio>/`:
- `domain/` — sem I/O, sem framework.
- `application/` — casos de uso (orquestra domínio + portas).
- `infrastructure/` — adapters (Supabase, Auvo, Evolution…).
- Features de domínios diferentes **não se importam** — compartilhe via `packages/`.

## Segurança — OS-grade (obrigatório neste projeto)
RLS FORCE em toda tabela · schemas por domínio · `audit.*` append-only · secrets em Vault ·
refresh OAuth em Vault · webhooks com HMAC · `service_role` nunca no client.
Ver `seguranca/os-grade.md`. Toda dívida → `docs/SECURITY_DEBT.md`.

## Divergência da spec (SPEC_DEVIATION)
1. Pare. Marque `// SPEC_DEVIATION: <motivo>` no código e em `tasks.md`.
2. Decida: corrige o código OU atualiza a spec + ADR.
3. Nunca silencioso — spec e código divergentes = fonte da verdade apodrecendo.

## Definition of Done
`Definition-of-Done.md` (gates executáveis). Resumo:
- AC verdes **pelo comando** (não inspeção).
- `pnpm test` · `pnpm run typecheck` · `pnpm run lint` · `node scripts/audit-esteira.mjs` · `node scripts/eval-spec-fidelity.mjs` verdes.
- Sem `SPEC_DEVIATION` pendente · ADRs registrados · glossário e `docs/STATE.md` atualizados.

## Mapa de documentos sob demanda
- **Identidade do projeto:** `docs/PROJECT.md`.
- **Arquitetura:** `docs/ARCHITECTURE.md` (9 bounded contexts, context-map, schemas).
- **Requirements por módulo:** `docs/blueprint/`.
- **Glossário:** `docs/glossary.md`.
- **Banco:** `db/README.md`, `db/rls.template.sql`, `db/rls-test.md`.
- **Segurança:** `seguranca/baseline-minimo.md`, `seguranca/os-grade.md`, `seguranca/threat-model.template.md`.
- **Helpers de código:** `apps/web/src/lib/log.ts`, `apps/web/src/lib/http/problem.ts`, `apps/web/src/config/env.ts`.
- **Edge Functions:** `supabase/functions/_template/index.ts` + `_shared/`.
- **Observabilidade/ops:** `observabilidade/README.md`, `runbooks/`.
- **IA/LLM:** `ia/` (só em feature com LLM — Agente Zé, laudos, propostas).
- **Exemplos SDD completos:** `specs/_examples/` (domínio puro + I/O).
- **Estado do trabalho:** `docs/STATE.md` (volátil; atualize ao pausar/retomar — use `/handoff`).
- **Decisões duráveis:** `docs/adr/` (nunca edite um ADR; crie um que o substitua).
