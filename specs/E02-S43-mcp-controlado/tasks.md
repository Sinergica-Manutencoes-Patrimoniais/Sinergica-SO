# Tasks — E02-S43

Tier arquitetural: ADR-1696 antes de implementar. Branch empilhada em
`feat/E01-S198-api-dominio-staging` (ver plan.md — "bloqueada" é sobre homologação em produção,
não sobre desenvolvimento em cima da dependência já codada).

- [x] T1 — Migration `1855`: `pcm.sso_mcp_chamadas` (registro append-only),
  `sso_registrar_uso_mcp` (grava sucesso e recusa), `sso_listar_uso_mcp_proprio` (isolamento por
  ator, mesma porta única sem policy).
- [x] T2 — Edge Function `pcm-mcp/index.ts`: JSON-RPC 2.0 mínimo (`initialize`/`tools/list`/
  `tools/call`), catálogo fechado em código (1 ferramenta: `consultar_levantamento`), NENHUM
  acesso a `schema("pcm")` de domínio — só `fetch` pra `pcm-api-dominio` repassando o
  Authorization do usuário real.
- [x] T3 — `scripts/check-mcp-ferramentas-controladas.mjs` (AC-2/AC-3): guard de CI — falha se
  aparecer `.from(`/`.rpc(` de domínio fora da auditoria própria, SQL genérico, ou
  `service_role`. Wired em `ci.yml`.
- [x] T4 — `supabase/config.toml`: declara `pcm-mcp` (`verify_jwt=true`).
- [x] T5 — pgTAP `E02-S43_registro_uso_mcp.test.sql` (13 assertions): registro de sucesso e
  recusa, isolamento por ator, porta única (sem SELECT direto na tabela).
- [x] T6 — Verificação: `deno check`/`deno test` limpos (425 PASS), `check:edge-functions`
  limpo (82 funções declaradas), pgTAP completo (269 arquivos/3402 testes, PASS, zero
  regressão), `biome-baseline.mjs` zero dívida nova.
- [ ] T7 — SPEC_DEVIATION: só leitura nesta etapa (US2/escrita fica pra depois, ver ADR-1696).
- [ ] T8 — SPEC_DEVIATION: registro de uso é best-effort, não transacional com a ação de
  domínio (duas operações em serviços HTTP diferentes).

## Definition of Done

- AC-1/AC-2/AC-3 (isolamento herdado, sempre via API de domínio, sem SQL genérico) garantidos
  por desenho + guard de CI.
- AC-6/AC-8 (registro identifica usuário e ferramenta, inclusive recusa) provados em pgTAP.
- AC-7/AC-9 (autorização do servidor decide; revogação imediata) herdados estruturalmente da
  cadeia `pcm-mcp → pcm-api-dominio → RPC`, nunca reimplementados aqui.
- AC-4/AC-5 (escrita com confirmação) e idempotência de escrita (AC-10): SPEC_DEVIATION
  explícito, próxima etapa nomeada.
