# Logs das fixtures SQL verificadas em clone sintético

Execução isolada; saídas preservadas sem credenciais de conexão.

## E01-S166_decisao_feriado_calendario.test.sql

```text
BEGIN
SET
psql:/tmp/E01-S166_decisao_feriado_calendario.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
CREATE EXTENSION
SET
SET
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 2
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
DELETE 1
INSERT 0 1
INSERT 0 1
 plan 
------
 1..9
(1 row)

SET
SET
               throws_ok               
---------------------------------------
 ok 1 - gates fechados impedem decisão
(1 row)

RESET
UPDATE 1
UPDATE 1
INSERT 0 1
SET
            throws_ok            
---------------------------------
 ok 2 - capacidade é obrigatória
(1 row)

RESET
INSERT 0 1
SET
                  is                  
--------------------------------------
 ok 3 - ciclo existente é apresentado
(1 row)

                    is                    
------------------------------------------
 ok 4 - feriado mantém obrigação para PCM
(1 row)

               is               
--------------------------------
 ok 5 - replay conserva revisão
(1 row)

              throws_ok               
--------------------------------------
 ok 6 - requestId divergente é negado
(1 row)

            throws_ok             
----------------------------------
 ok 7 - revisão obsoleta é negada
(1 row)

RESET
                   is                   
----------------------------------------
 ok 8 - data original permanece intacta
(1 row)

                is                 
-----------------------------------
 ok 9 - replay não duplica decisão
(1 row)

 finish 
--------
(0 rows)

ROLLBACK
```

## E01-S166_ciclos_mediados_fluxo.test.sql

```text
BEGIN
NOTICE:  extension "pgtap" already exists, skipping
CREATE EXTENSION
SET
SET
 plan 
------
 1..8
(1 row)

INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 2
INSERT 0 1
INSERT 0 1
INSERT 0 1
UPDATE 1
SET
SET
                 throws_ok                  
--------------------------------------------
 ok 1 - gate do núcleo continua obrigatório
(1 row)

RESET
UPDATE 1
SET
             throws_ok             
-----------------------------------
 ok 2 - ator divergente é recusado
(1 row)

              throws_ok               
--------------------------------------
 ok 3 - Cliente divergente é recusado
(1 row)

              throws_ok              
-------------------------------------
 ok 4 - versão divergente é recusada
(1 row)

                is                
----------------------------------
 ok 5 - dois ciclos de calendário
(1 row)

                  is                   
---------------------------------------
 ok 6 - ciclo seguinte preserva âncora
(1 row)

                      ok                      
----------------------------------------------
 ok 7 - tolerâncias independentes preservadas
(1 row)

RESET
UPDATE 1
SET
             throws_ok              
------------------------------------
 ok 8 - revogação bloqueia consulta
(1 row)

RESET
 finish 
--------
(0 rows)

ROLLBACK
```

## E01-S166_calculo_ciclos.test.sql

```text
BEGIN
CREATE EXTENSION
NOTICE:  extension "pgtap" already exists, skipping
SET
 plan  
-------
 1..16
(1 row)

                    is                    
------------------------------------------
 ok 1 - fevereiro bissexto usa último dia
(1 row)

                  is                  
--------------------------------------
 ok 2 - março retorna ao dia original
(1 row)

                 is                  
-------------------------------------
 ok 3 - ano bissexto recupera âncora
(1 row)

                 is                 
------------------------------------
 ok 4 - semanas respeitam intervalo
(1 row)

             is              
-----------------------------
 ok 5 - dias respeitam ciclo
(1 row)

             is             
----------------------------
 ok 6 - ciclo zero é âncora
(1 row)

                           is                           
--------------------------------------------------------
 ok 7 - trimestre cruza ano e ajusta fevereiro à âncora
(1 row)

                               is                               
----------------------------------------------------------------
 ok 8 - trimestre seguinte recupera dia original após fevereiro
(1 row)

             throws_ok              
------------------------------------
 ok 9 - intervalo deve ser positivo
(1 row)

              throws_ok              
-------------------------------------
 ok 10 - ciclo não pode ser negativo
(1 row)

                    throws_ok                    
-------------------------------------------------
 ok 11 - modo visita não é unidade de calendário
(1 row)

            throws_ok            
---------------------------------
 ok 12 - data base é obrigatória
(1 row)

          throws_ok           
------------------------------
 ok 13 - overflow é rejeitado
(1 row)

                     is                     
--------------------------------------------
 ok 14 - século não bissexto usa último dia
(1 row)

                  throws_ok                  
---------------------------------------------
 ok 15 - datas além do limite são rejeitadas
(1 row)

                             ok                             
------------------------------------------------------------
 ok 16 - função interna não é exposta a usuário autenticado
(1 row)

 finish 
--------
(0 rows)

ROLLBACK
```

## E01-S166_fila_preventiva_pcm_guardas.test.sql

```text
BEGIN
 plan 
------
 1..5
(1 row)

                   ok                   
----------------------------------------
 ok 1 - comando tem entrada autenticada
(1 row)

               ok                
---------------------------------
 ok 2 - anon não executa comando
(1 row)

                    ok                     
-------------------------------------------
 ok 3 - usuário não grava fila diretamente
(1 row)

             throws_ok              
------------------------------------
 ok 4 - gate fechado impede comando
(1 row)

              throws_ok              
-------------------------------------
 ok 5 - gate fechado impede consulta
(1 row)

 finish 
--------
(0 rows)

ROLLBACK
```

## E01-S166_triagem_atraso.test.sql

```text
BEGIN
SET
psql:/tmp/E01-S166_triagem_atraso.test.sql:4: NOTICE:  extension "pgtap" already exists, skipping
CREATE EXTENSION
SET
SET
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 2
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
DELETE 1
INSERT 0 1
INSERT 0 1
 plan 
------
 1..9
(1 row)

SET
SET
             throws_ok              
------------------------------------
 ok 1 - gate fechado impede triagem
(1 row)

RESET
UPDATE 1
SET
             throws_ok             
-----------------------------------
 ok 2 - exige capacidade de gestão
(1 row)

RESET
INSERT 0 1
SET
                 is                  
-------------------------------------
 ok 3 - candidato elegível é listado
(1 row)

               is                
---------------------------------
 ok 4 - triagem registra revisão
(1 row)

                 is                  
-------------------------------------
 ok 5 - replay devolve mesma revisão
(1 row)

               throws_ok                
----------------------------------------
 ok 6 - requestId divergente é recusado
(1 row)

             throws_ok              
------------------------------------
 ok 7 - revisão obsoleta é recusada
(1 row)

                       throws_ok                        
--------------------------------------------------------
 ok 8 - vencimento dentro da tolerância não é candidato
(1 row)

RESET
                is                 
-----------------------------------
 ok 9 - replay não duplica triagem
(1 row)

 finish 
--------
(0 rows)

ROLLBACK
```

## E01-S166_ciclos_mediados_acl.test.sql

```text
BEGIN
CREATE EXTENSION
SET
NOTICE:  extension "pgtap" already exists, skipping
 plan 
------
 1..7
(1 row)

                 ok                 
------------------------------------
 ok 1 - gate mediado inicia fechado
(1 row)

                ok                
----------------------------------
 ok 2 - anon não executa mediador
(1 row)

                     ok                      
---------------------------------------------
 ok 3 - usuário autenticado alcança mediador
(1 row)

               ok                
---------------------------------
 ok 4 - núcleo permanece privado
(1 row)

                   ok                   
----------------------------------------
 ok 5 - usuário não lê gate diretamente
(1 row)

             ok              
-----------------------------
 ok 6 - gate tem RLS forçada
(1 row)

SET
SET
              throws_ok              
-------------------------------------
 ok 7 - gate fechado recusa consulta
(1 row)

RESET
 finish 
--------
(0 rows)

ROLLBACK
```

## E01-S166_gates_fotos_distintos.test.sql

```text
NOTICE:  extension "pgtap" already exists, skipping
BEGIN
CREATE EXTENSION
SET
 plan 
------
 1..7
(1 row)

                  has_table                  
---------------------------------------------
 ok 1 - gate S176 de fotos cadastrais existe
(1 row)

                  has_table                  
---------------------------------------------
 ok 2 - gate S166 de foto de atestado existe
(1 row)

               ok                
---------------------------------
 ok 3 - gate S176 começa fechado
(1 row)

                       ok                       
------------------------------------------------
 ok 4 - leitura e escrita S166 começam fechadas
(1 row)

             ok             
----------------------------
 ok 5 - gate S166 exige RLS
(1 row)

                   ok                    
-----------------------------------------
 ok 6 - autenticado não altera gate S166
(1 row)

                   ok                    
-----------------------------------------
 ok 7 - autenticado não altera gate S176
(1 row)

 finish 
--------
(0 rows)

ROLLBACK
```

## E01-S166_S177_rollout_acl.test.sql

```text
BEGIN
NOTICE:  extension "pgtap" already exists, skipping
CREATE EXTENSION
SET
 plan  
-------
 1..18
(1 row)

                                                               ok                                                               
--------------------------------------------------------------------------------------------------------------------------------
 ok 1 - anon não executa pcm.sso_pcm_gerar_visita(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)
 ok 2 - authenticated não executa pcm.sso_pcm_gerar_visita(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)
 ok 3 - service_role não executa pcm.sso_pcm_gerar_visita(uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)
 ok 4 - anon não executa pcm.sso_pcm_gerar_visita_suprimivel(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)
 ok 5 - authenticated não executa pcm.sso_pcm_gerar_visita_suprimivel(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)
 ok 6 - service_role não executa pcm.sso_pcm_gerar_visita_suprimivel(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text)
 ok 7 - anon não executa pcm.sso_localizar_codigo_publico(uuid,text)
 ok 8 - authenticated não executa pcm.sso_localizar_codigo_publico(uuid,text)
 ok 9 - service_role não executa pcm.sso_localizar_codigo_publico(uuid,text)
 ok 10 - anon não executa pcm.sso_localizar_codigo_publico_mediada(uuid,uuid,text)
 ok 11 - authenticated não executa pcm.sso_localizar_codigo_publico_mediada(uuid,uuid,text)
 ok 12 - service_role não executa pcm.sso_localizar_codigo_publico_mediada(uuid,uuid,text)
 ok 13 - anon não executa pcm.sso_listar_aliases_ativo(uuid,text,uuid,uuid,integer)
 ok 14 - authenticated não executa pcm.sso_listar_aliases_ativo(uuid,text,uuid,uuid,integer)
 ok 15 - service_role não executa pcm.sso_listar_aliases_ativo(uuid,text,uuid,uuid,integer)
 ok 16 - anon não executa pcm.sso_listar_aliases_ativo_mediada(uuid,uuid,text,uuid,uuid,integer)
 ok 17 - authenticated não executa pcm.sso_listar_aliases_ativo_mediada(uuid,uuid,text,uuid,uuid,integer)
 ok 18 - service_role não executa pcm.sso_listar_aliases_ativo_mediada(uuid,uuid,text,uuid,uuid,integer)
(18 rows)

 finish 
--------
(0 rows)

ROLLBACK
```


