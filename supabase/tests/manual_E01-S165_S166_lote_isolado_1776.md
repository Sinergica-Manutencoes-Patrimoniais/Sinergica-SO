---
name: "supabase-tests-manual-e01-s165-s166-lote-isolado-1776-md"
description: "Documento Sinérgica SO: Lote S165/S166 até 1776"
alwaysApply: false
---

# Lote S165/S166 até 1776

Em 2026-11-05, migrations 1614–1776 compilaram em ordem numérica em banco descartável, restaurado a partir da base histórica local até 1613 no contêiner isolado, sem cron/net. Grants de schema necessários às fixtures foram restaurados; o ensaio não comprova ACL global em produção.

Passaram 25 fixtures SQL com `ON_ERROR_STOP` em transações revertidas: as 24 do lote `manual_E01-S165_S166_lote_isolado_1775.md` mais `manual_E01-S165_transicao_conflito_1776.sql`. Nove arquivos de interface passaram, totalizando 36 testes, incluindo o tratamento de conflitos e replay da transição, classificação legada, fila e Visita. Não houve expectativas obsoletas neste lote.

Este não é o conjunto completo de testes nem prova CI remoto, integrações externas, carga ou homologação. Gates ou guardas simulados por determinadas fixtures foram alterados apenas no clone. Nenhum deploy ou chamada ao Auvo ocorreu. O clone foi removido.
