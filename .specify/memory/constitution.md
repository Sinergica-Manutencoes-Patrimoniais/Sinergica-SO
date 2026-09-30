# Sinérgica SO — Constituição

Regras curtas que valem para toda spec, plano e implementação. Só entra aqui o que alguém
verifica (CI, review ou `/revisao-adversarial`). Detalhe: `CLAUDE.md`, `seguranca/os-grade.md`.

## I. Segurança de dados (inegociável)
- Toda tabela de aplicação: `enable` + **`force row level security`**, em schema do domínio.
- Tabela/policy nova ou alterada tem teste pgTAP em `supabase/tests/` com caso permitido **e** negado
  (job `db-tests` da CI; não pode ser pulado).
- `audit.*` é append-only: UPDATE/DELETE negados para todos, inclusive `service_role`.
- Segredo, refresh OAuth e credencial de integração ficam no Vault/servidor; nunca no client,
  log, erro exibido ou URL. `service_role` nunca no client.
- Edge Function: CORS → `requireAuth` (JWT) → rate-limit → validar Zod → lógica → resposta sem stack.
  Webhook de terceiro valida HMAC com `constantTimeEqual`.
- Escrita checa papel/permissão no servidor (RPC/policy), não só na UI. Input validado na borda (Zod).
- Dado pessoal (LGPD) minimizado, com trilha em `audit.*`. Dívida aceita → `docs/SECURITY_DEBT.md`.

## II. Mudança segura em produção
- Migration `NNNN_E0N-S0N_descricao.sql`, sequência sem pular, **aditiva**. Remoção/renomeação
  destrutiva só em deploy posterior, com o código já sem uso. Nunca edite migration aplicada.
- Tabela com volume: índice composto `(workspace_id, created_at)`; lista paginada; sem N+1;
  operação financeira idempotente (`request_id` único); dinheiro em centavos (inteiro).
- Mudança que envia mensagem real (WhatsApp/Zé/fila) é testada em canal de teste antes do merge.

## III. Arquitetura
- `apps/web/src/features/<dominio>/{domain,application,infrastructure,interfaces}`;
  dependência `interfaces → application → domain ← infrastructure`.
- `domain` sem framework nem I/O. Supabase/Auvo/Evolution só em `infrastructure`.
- Domínios não se importam: compartilhe via `packages/`. PCM é o system of record.
- Dado de servidor sempre via **TanStack Query** (`application/<dominio>-queries.ts`, chaves em
  `<dominio>QueryKeys`, invalidar após escrever). `useState` só para estado local de UI.
- Decisão difícil de reverter vira ADR em `docs/adr/` **antes** de implementar.

## IV. Spec, rastreio e escopo
- Spec vive em `specs/E0N-S0N-<nome>/`; commit `tipo(E0N-S0N): …`; ROADMAP com owner antes de codar.
- Cada Acceptance Scenario da `spec.md` tem id **AC-N**; cada task de `tasks.md` cita o(s) AC-N.
  `eval:spec` falha se algum AC-N não tem task.
- "Fora de escopo" é vinculante. Spec ambígua: pare e pergunte. Divergência: `SPEC_DEVIATION`
  registrado em código e `tasks.md`, e depois corrige o código **ou** atualiza spec + ADR.
- Termos de `docs/glossary.md`, sem sinônimos; termo novo entra no glossário no mesmo PR.
- YAGNI: sem abstração "para o futuro"; generalize só no 2º/3º uso; refactor amplo é tarefa própria.

## V. Qualidade proporcional
- Done = comando verde, não inspeção. Regra de `domain`/`application` tem teste unitário;
  bug corrigido ganha teste que falhava antes.
- E2E só para jornada crítica, sob demanda. Tier arquitetural passa por `/revisao-adversarial`.
- Interface segue `DESIGN.md`: tokens, primitivas de `packages/ui`, todo estado tratado
  (carregando/vazio/erro/sucesso), teclado com foco visível. Erro na borda em `problem+json` com `reqId`.

## Governança
Emenda: edite este arquivo no mesmo PR da mudança que a motiva. Regra que atrapalha mais do
que protege é removida, não contornada.

**Version**: 1.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: 2026-09-30
