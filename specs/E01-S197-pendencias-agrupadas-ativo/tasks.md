# Tasks — E01-S197

- [x] T1 — Investigação (obrigatória antes de codar, per BL 008): leitura de
  `PendenciasTecnicasWorkspace.tsx`, `0371_E01-S173`, `0375_E01-S174`, `1097_E01-S173` — achado:
  AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9 já estavam implementados; nenhuma entidade
  nova necessária (confirma o próprio Key Entities da spec).
- [x] T2 — pgTAP `E01-S197_pendencias_agrupadas_ativo.test.sql` (20 assertions, zero migration
  nova): prova o cenário literal do SC-001 ("7 achados, 2 ao Backlog, 5 conservadas") reusando a
  fixture de E01-S173, cobrindo de graça o Edge Case "Grupo quantitativo sem TAG individual".
- [x] T3 — AC-F2: declara em `.env.example` as 3 flags já usadas em código existente
  (`VITE_SSO_PENDENCIAS_TECNICAS_ENABLED`, `VITE_SSO_PENDENCIAS_FILTRO_ATIVO_ENABLED`,
  `VITE_SSO_BACKLOG_COMPOSICAO_ENABLED`) e nunca declaradas antes.
- [x] T4 — Suíte local: pgTAP completa (269 arquivos/3409 testes, PASS),
  `biome-baseline.mjs` (zero dívida nova — nenhum código de produção tocado, só teste e
  `.env.example`).

## Definition of Done

- SC-001 passa como teste automatizado (AC literal do Fabrício).
- SC-002/SC-003/SC-004 confirmados (nenhum resultado além de Não OK gera pendência; nenhuma OS/
  Chamado criado; agrupamento funciona pra Grupo quantitativo sem TAG).
- Achado de "já implementado" documentado explicitamente — não silencioso, não reimplementado.
