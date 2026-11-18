# Tasks — E01-S198

Tier arquitetural + P2 ("desenhar agora, implementar por etapas"): ADR-1695 escrito antes de
implementar.

- [x] T1 — Achado prévio: staging robusto já existe (`0315`/`0318`/`0883`, E01-S178); a
  aprovação parcial (`0883`) está com EXECUTE revogado de `authenticated` e 2 gates fechados —
  não entra nesta etapa.
- [x] T2 — Edge Function `pcm-api-dominio/index.ts`: envelope versionado (`versao: "v1"`), 2
  ações (`levantamento.criar_lote`, `levantamento.consultar_previa`), client no contexto do
  usuário (nunca `service_role`), as cinco camadas explícitas (AC-9).
- [x] T3 — `scripts/check-api-dominio-cinco-camadas.mjs` (SC-004): guard de CI — falha se faltar
  `requireAuth`/schema Zod/`requestId`, se aparecer RPC com nome dinâmico, SQL genérico, ou
  `service_role`. Wired em `ci.yml`.
- [x] T4 — `supabase/config.toml`: declara `pcm-api-dominio` (`verify_jwt=true`) — sem isso
  `check:edge-functions` acusa função órfã e o deploy real não acontece.
- [x] T5 — Verificação: `deno check` limpo; `pnpm run check:edge-functions` limpo; pgTAP
  completo (268 arquivos/3389 testes, PASS — nenhuma migration nova, zero regressão); Deno test
  completo (425 PASS, nenhum teste quebrado pela função nova).
- [ ] T6 — SPEC_DEVIATION: `levantamento.aprovar`/`rejeitar` (AC-5/AC-6/AC-7) ficam pra próxima
  etapa — reabertura de gate é decisão humana separada (ver ADR-1695).
- [ ] T7 — SPEC_DEVIATION: AC-3 só parcialmente literal — validação é tudo-ou-nada na entrada do
  lote (RPC já testada, não reescrita), não erro granular por item numa única resposta.

## Definition of Done

- AC-1/AC-2/AC-4 (criar lote, idempotência, prévia) fechados e verificados.
- AC-8/AC-9/AC-10 (sem SQL genérico, cinco camadas, isolamento herdado de RLS) garantidos por
  desenho + guard de CI.
- AC-5/AC-6/AC-7 e parte de AC-3: SPEC_DEVIATION explícito, próxima etapa nomeada, não silêncio.
- `/revisao-adversarial`: client sempre no contexto do usuário (nunca service_role) — garante
  que autorização/auditoria herdadas realmente rodam como o ator, não o sistema; guard de CI
  trava isso estruturalmente, não só por revisão humana pontual.
