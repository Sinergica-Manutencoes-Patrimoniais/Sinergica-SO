# Lote isolado S165/S166 até migration 1769

Em 2026-11-05, migrations 1614–1769 compilaram em clone PostgreSQL descartável, criado a partir de dump da base histórica local no contêiner isolado, sem cron/net. Foram restaurados os grants de schemas necessários; isso não verifica ACL global nem equivale à produção.

Passaram 21 fixtures SQL, com `ON_ERROR_STOP` e cada cenário executado em transação revertida: as 18 listadas em `manual_E01-S165_S166_lote_isolado_1767.md`, mais `manual_E01-S165_ac5_aprovacao_os_aberta_1768.sql`, `manual_E01-S165_ac5_os_aberta_revisao_1768.sql` e `manual_E01-S165_conflito_edicao_rotina_1768.sql`. O lote cobre aprovação, preservação de OS, suspensão, geração, filas, avaliações e reconciliação. Gates e substituições de teste, quando previstos pelas fixtures, ocorreram somente no clone.

Algumas fixtures não abrem transação própria; no primeiro ensaio isso contaminou os cenários seguintes. O clone foi descartado, recriado e todo o lote repetido com `BEGIN` e `ROLLBACK` envolvendo cada fixture. A aprovação não comprova CI remoto, ACL integral, integrações externas ou homologação. Nenhum deploy ou chamada ao Auvo ocorreu.
