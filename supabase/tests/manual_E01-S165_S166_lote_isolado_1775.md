---
name: "supabase-tests-manual-e01-s165-s166-lote-isolado-1775-md"
description: "Documento Sinérgica SO: Lote S165/S166 até 1775"
alwaysApply: false
---

# Lote S165/S166 até 1775

Em 2026-11-05, migrations 1614–1775 compilaram em ordem numérica em banco descartável, restaurado a partir da base histórica local até 1613 no contêiner isolado, sem cron/net. Grants de schema necessários às fixtures foram restaurados; isso não comprova as ACLs completas em produção.

Passaram 24 fixtures SQL com `ON_ERROR_STOP` em transações revertidas: as 23 do lote `manual_E01-S165_S166_lote_isolado_1774.md`, mais `manual_E01-S165_conflito_legado_1775.sql`. Oito arquivos de testes de interface passaram, totalizando 33 testes, cobrindo classificação legada, replay, fila, reserva, retiradas e lote de Visita.

Inicialmente um teste de interface esperava `40001` para `fotografia_obsoleta`, mas a migration 1775 passou a retornar o conflito de negócio `P0019` e a interface reconhece esse código exato. Foi atualizado apenas o mock do teste; o lote de interface passou na repetição. Erros reais de serialização 40001 continuam distintos.

Este não é o conjunto completo de testes nem prova CI remoto, ACL global, integrações externas, carga ou homologação. Gates ou guardas simulados por determinadas fixtures foram alterados apenas no clone. Nenhum deploy ou chamada ao Auvo ocorreu. Clone removido.
