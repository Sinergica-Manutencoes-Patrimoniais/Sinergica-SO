---
name: "supabase-tests-log-e01-s166-s177-concorrencia-tcp-isolado-md"
description: "Documento Sinérgica SO: S166/S177 — concorrência por TCP interno"
alwaysApply: false
---

# S166/S177 — concorrência por TCP interno

Clone sintético isolado, rede interna, sem portas publicadas. Credencial sintética efêmera alterada apenas no clone e omitida desta evidência. Fixture adaptada somente em memória para loopback; não comprova Auth ou integração oficiais.

```text
BEGIN
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
 dblink_connect 
----------------
 OK
(1 row)

 dblink_exec 
-------------
 BEGIN
(1 row)

 dblink_exec 
-------------
 DO
(1 row)

SET
                          throws_ok                          
-------------------------------------------------------------
 ok 1 - busca falha fechada durante alteração de autorização
(1 row)

                          throws_ok                          
-------------------------------------------------------------
 ok 2 - lista falha fechada durante alteração de autorização
(1 row)

                           throws_ok                           
---------------------------------------------------------------
 ok 3 - geração falha fechada durante alteração de autorização
(1 row)

RESET
 dblink_exec 
-------------
 ROLLBACK
(1 row)

 dblink_disconnect 
-------------------
 OK
(1 row)

 finish 
--------
(0 rows)

ROLLBACK

NOTICE:  extension "pgtap" already exists, skipping
```

