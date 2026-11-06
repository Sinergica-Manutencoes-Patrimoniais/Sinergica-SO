# Lote S165/S166 até 1774

Em 2026-11-05, migrations 1614–1774 compilaram em ordem numérica em banco descartável, restaurado a partir da base histórica local até 1613 no contêiner isolado, sem cron/net. Foram restaurados grants de schema necessários à fixture; não se conclui que as ACLs completas correspondam à produção.

Passaram 23 fixtures SQL com `ON_ERROR_STOP`, em transações revertidas: as 18 do lote `manual_E01-S165_S166_lote_isolado_1767.md`, mais três fixtures de AC5/edição 1768, a fixture de inclusão/retirada 1769 e a de reabertura de fila Grupo. Abrangem aprovação, geração, preservação de OS, suspensão, filas, avaliações, reconciliação e conflitos. Algumas fixtures simulam exclusivamente no clone gates ou guardas; detalhes estão nos arquivos das próprias fixtures. O typecheck `pnpm --filter web typecheck` passou.

Este lote não é a suíte completa, não comprova ACL global, CI remoto, integrações externas, comportamento sob carga ou homologação. Nenhum deploy ou chamada ao Auvo ocorreu. O clone foi removido.
