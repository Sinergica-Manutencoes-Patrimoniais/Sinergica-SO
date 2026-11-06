---
name: "supabase-tests-log-e01-s166-s177-concorrencia-isolado-md"
description: "Documento Sinérgica SO: Validação isolada S166/S177 — log da primeira falha"
alwaysApply: false
---

# Validação isolada S166/S177 — log da primeira falha

Clone sintético descartável; banco e rede removidos após a sessão. `ON_ERROR_STOP=1`; fixture executada via socket local, sem portas externas. Falha de conexão `dblink` antes das três asserções. Não demonstra falha de regra de negócio.

```text
BEGIN
NOTICE:  extension "pgtap" already exists, skipping
CREATE EXTENSION
CREATE EXTENSION
SET
 plan 
------
 1..3
(1 row)

GRANT
GRANT
SET
ERROR:  could not establish connection
DETAIL:  could not parse network address "port=": Name or service not known
```

