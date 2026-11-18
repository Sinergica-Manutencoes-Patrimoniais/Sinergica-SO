# Tasks — E01-S195

- [x] T1 — Achado prévio: grep exaustivo confirma ausência de "hora contratada"/"limite de
  jornada" no repositório — muda a leitura de AC-6 (garantia por ausência) e AC-7
  (SPEC_DEVIATION parcial, sem denominador pra "excedente").
- [x] T2 — Migration `1855`: `pcm.sso_trechos_deslocamento` (aditiva, imutável),
  `sso_enquadrar_trecho_deslocamento` (função pura, coluna `generated always as ... stored`).
- [x] T3 — `pcm.sso_declarar_trechos_visita` (grava o dia inteiro, atômico, idempotente por
  `request_id`) e `pcm.sso_listar_trechos_visita` (lê a revisão vigente + `revisao_visita_atual`
  fresca mesmo sem nenhum trecho ainda) (AC-1, AC-8, AC-10).
- [x] T4 — pgTAP `E01-S195_trechos_deslocamento.test.sql` (23 assertions): todos os pares
  origem×destino relevantes (AC-2/AC-3/AC-4), prova estrutural de AC-2 (sem coluna de veículo) e
  AC-6 (sem coluna de hora contratada), idempotência, imutabilidade, autorização.
- [x] T5 — Frontend: `TrechosDeslocamento.tsx` (novo), mount em `FontesDemanda.tsx` ao lado de
  `DeslocamentoDeclarado`, flag `VITE_SSO_TRECHOS_DESLOCAMENTO_ENABLED` declarada em
  `.env.example`/`netlify.toml` (AC-F1/AC-F2).
- [x] T6 — Teste do componente (`TrechosDeslocamento.test.tsx`) — achou e corrigiu 2 bugs reais
  antes de publicar: `instanceof Error` nunca reconhece erro do Postgrest; faltava `retry: false`
  (ver plan.md).
- [x] T7 — ADR-1693 — decisão de entidade aditiva (não editar `1357`) e dos dois SPEC_DEVIATION.
- [ ] T8 — SPEC_DEVIATION: AC-7 só devolve o bruto computável, não compara contra limite de
  jornada — decisão de produto pendente (qual é o limite, por técnico ou por Cliente).
- [x] T9 — Suíte local: pgTAP completa (269 arquivos/3412 testes, PASS), typecheck `apps/web`
  (0 erros), `vitest run src/features/pcm` (2058 PASS), `biome-baseline.mjs` (zero dívida nova).

## Definition of Done

- AC-1 a AC-5, AC-8, AC-9, AC-10 fechados com prova (pgTAP + teste de componente).
- AC-6 fechado por ausência estrutural, provado por teste de schema.
- AC-7 parcial, SPEC_DEVIATION explícito — não silencioso.
- Gate novo nasce fechado; procedimento de abertura/retorno escrito no plan.md antes de existir.
