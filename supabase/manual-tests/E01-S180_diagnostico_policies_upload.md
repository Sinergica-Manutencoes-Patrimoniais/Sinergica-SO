---
name: "supabase-manual-tests-e01-s180-diagnostico-policies-upload-md"
description: "Documento Sinérgica SO: E01-S180 — Diagnóstico de policies de upload"
alwaysApply: false
---

# E01-S180 — Diagnóstico de policies de upload

Em 30/10/2026, banco sintético reconstruído em rede Docker interna, sem portas
publicadas, com `cron.launch_active_jobs=off` e todos os jobs desativados.
Bootstrap condicionado por cópias temporárias de seis migrations históricas;
não comprova bootstrap oficial nem ambiente remoto.

O teste `E01-S180_mediacao_upload.test.sql` terminou 9/10: o INSERT autorizado
no bucket S180 falhou com `42501: permission denied for function
sso_autorizar_upload_evidencia_material`. O `psql` retornou zero apesar do
TAP apresentar falha; conferir sempre `not ok` e `finish()`.

As policies de INSERT dos seis buckets SSO compartilham `storage.objects` e
referenciam diretamente helpers cujo EXECUTE foi revogado de `authenticated`.
A conferência de ACL de helper referente a outro bucket interrompe o INSERT.
Conceder todos os EXECUTEs isoladamente não é correção segura: pode também
alterar permissões efetivas de outros buckets.

O experimento existente `manual_s180_dispatch_guard_global.sql` altera
temporariamente policies sob transação e usa o dispatcher/guarda da 0996.
Nesta execução, somente o trecho inicial foi repetido, suprimindo a inclusão
da 0996 já instalada e encerrando antes dos testes que modificam gates. Os
nove testes passaram: oito buckets negados com ACL parcial e presença da
restritiva S184. A transação foi revertida; gates não foram modificados pelo
experimento. Não houve envio de bytes, tarefa Auvo ou dispatch.

O experimento completo foi então executado em rollback: 14/14, incluindo
upload S180 positivo com gate temporariamente aberto, bucket legado negado
com ACL parcial, Financeiro positivo com ACLs abertas e negativo após
desativação. O teste original 0966, precedido pela instalação transitória do
dispatcher, guarda e policies do mesmo experimento, passou 10/10 e também
reverteu. Após rollback, gate estava fechado, policy experimental ausente,
jobs inativos e fila HTTP vazia.

Matriz reproduzível `E01-S180_matriz_storage.sql`: 52 combinações de 13
buckets e quatro JWTs comparadas com ACLs abertas e gates fechados; 5/5
verificações, incluindo `anon` negado. Os JWTs variam claims do mesmo usuário
sintético; não abrangem todos os perfis reais.

`rtk proxy bash supabase/manual-tests/E01-S180_storage_positivos.sh` executou
55/55 no mesmo banco: teste existente adaptado em memória para usar dispatcher
e guarda da 0996, com gates/ACLs temporariamente abertos. Todos os seis
buckets SSO aceitaram objeto próprio, rejeitaram outro Cliente/owner e
rejeitaram novos INSERTs após desativação do usuário. Revogação foi
sequencial; não demonstra disputa concorrente. Script exige o banco isolado
`sso_diagnostico_reconstrucao` e a 0996 já aplicada; aplica somente alterações
em transação revertida. Não executá-lo contra produção.

Os recortes não comprovam equivalência completa para outros usuários, roles,
buckets, otimizações SQL, concorrência ou Storage real. A 0996 permanece
desconectada, e o ADR-0800
exige matriz completa, teste integrado, revisão adversarial e rollout
coordenado antes de qualquer mudança persistente. Não liberar gate.

## Storage HTTP e concorrência em clone sintético

Em 30/10/2026, foi criado banco descartável `sso_s180_storage_prova` no
Postgres interno, restaurado de dump do diagnóstico com pg_cron e pg_net
excluídos. Container Storage FILE rodou exclusivamente na mesma rede interna,
sem porta publicada e com segredo JWT sintético. As 12 policies, dispatcher,
guarda, ACLs e gates foram alterados somente no clone. Reutilizou-se a fixture
de `manual_s180_storage_helpers_autorizacao.sql` e wrappers do experimento
`E01-S180_matriz_storage.sql`.

`E01-S180_storage_http.mjs`, executado dentro do container Storage, obteve
HTTP 200 nos seis buckets com usuário ativo e negou os seis após desativação
com HTTP 400 e erro de RLS. JWT sintético inválido retornou 400. A primeira
execução esperava 401 para JWT inválido e falhou; expectativa foi corrigida e
repetida. Não exercita Auth real, bytes válidos, download ou navegador.

Teste de duas sessões, com o dispatcher/guarda original da 0996: no clone,
habilitar gates e grants das fixtures, iniciar transação A como authenticated
com JWT do usuário `16891000-0000-4000-8000-000000000001` e inserir objeto
`16891000-0000-4000-8000-000000000087` em `sso-grupos-fotos`, com caminho
`16891000-0000-4000-8000-000000000002/16891000-0000-4000-8000-000000000006/16891000-0000-4000-8000-000000000087`.
Sem confirmar A, transação B desativou o usuário e confirmou sem espera.
Após COMMIT de A, havia usuário inativo e objeto persistido. É uma corrida
real de autorização na combinação testada; não demonstra chamada HTTP
concorrente nem autoriza mudar policy em produção.

No mesmo clone, substituiu-se **apenas wrapper de teste** pelo corpo abaixo,
sem alteração de helpers existentes ou migration. O mesmo INSERT de Grupo
segurou a desativação até `lock_timeout=1s`; na ordem inversa, desativação
aberta fez INSERT retornar 42501 imediatamente. Ambas as sessões terminaram.

```sql
create or replace function pcm.sso_teste_dispatch_matriz(p_bucket text,p_nome text,p_owner text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then return false; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)
  ) then return false; end if;
  return pcm.sso_s180_dispatch_storage_experimental(p_bucket,p_nome,p_owner);
end $$;
```

É hipótese de solução limitada à fonte de autorização coberta pelo protocolo
global. Falta testar gates, vínculos, estado das entidades e ACLs sob disputa,
outros cinco buckets, isolamento e HTTP concorrente. Também falta medir
contenção e revisar compatibilidade; não instalar esse wrapper em produção.

## Preparação 1021

ADR-0833 e migration 1021 preparam dispatcher privado desconectado com a
mesma trava de autorização; não alteram policies ou gates. Teste de catálogo
observado vermelho antes de sua criação e depois 7/7 em rollback. Em outro
clone sintético, 1021 foi ligada a wrappers/policies somente de teste: um
INSERT com objetos válidos nos seis buckets conseguiu prosseguir, enquanto
transação concorrente de desativação atingiu `lock_timeout`. Em ordem inversa,
desativação aberta fez a chamada privada válida de Grupo retornar falso;
após rollback da desativação ela retornou verdadeiro. A trava foi exercitada
pelo dispatcher da 1021; uma transação com seis INSERTs não comprova
isoladamente a corrida de cada bucket. Não confirma outras fontes mutáveis.

## Fontes de autorização e ACL

Foi construído clone sintético `sso_s180_fontes_prova`, com as mesmas fixtures,
gates e ACLs abertos somente nele e wrappers transitórios conectados à 1021.
`E01-S180_fontes_concorrencia.sql`, usando dblink em duas sessões, encontrou
10/12 falhas na ordem upload primeiro: apenas despesa segurou gate e entidade.
Após aplicação da 1025 somente no clone e ligação do wrapper de teste,
passaram 32/32: as duas ordens para seis gates, seis entidades, gate de
validação, configuração do bucket de retorno, retorno e OS de materiais.
Nas ordens inversas, a mutação foi revertida; não provam alteração confirmada
antes de novo pedido, efeitos HTTP ou todos os escritores e fontes. A função
da 1025 tem 6/6 verificações de catálogo e permanece desconectada no projeto.

Uma corrida adicional permanece: com INSERT de foto de Grupo aberto e
autorizado, `REVOKE EXECUTE ON FUNCTION
pcm.sso_autorizar_upload_foto_grupo(text) FROM authenticated` confirmou sem
esperar, e o INSERT confirmou depois. Foram usados exclusivamente clone e
permissões sintéticas. GRANT/REVOKE SQL não adquire a trava consultada pelo
dispatcher; a 1025 não resolve este caso. Preservar bloqueio de ativação até
desenho que inclua DDL de ACL, compatibilidade e revisão adversarial.

## Investigação de DDL de ACL

Em banco vazio `sso_s180_ddl_prova`, event trigger `ddl_command_end` aceita
`GRANT`/`REVOKE` de função, mas `pg_event_trigger_ddl_commands()` relatou
`object_type=FUNCTION` com `object_identity`, `objid` e `classid` nulos. O
mesmo trigger não disparou em `GRANT anon TO authenticated`; essa alteração
de membership foi executada e revertida em transação. Portanto um trigger de
DDL de objetos, isoladamente, não cobre todas as formas de mudar privilégio.

Em duas sessões, `LOCK TABLE pg_catalog.pg_proc IN SHARE MODE NOWAIT` como
`supabase_admin` impediu tanto REVOKE do helper sintético como CREATE FUNCTION
não relacionado até `lock_timeout=200ms`; `GRANT anon TO authenticated`
continuou possível, em transação revertida. Com `SET ROLE postgres`, o mesmo
LOCK retornou `permission denied for table pg_proc`. Trava de catálogo traz
impacto global, exige privilégio elevado e não cobre membership; não é solução
segura ou portátil. Event trigger global também não foi instalado no projeto.

Alternativa a projetar: desvincular a autorização operacional das ACLs de
funções e migrar para estado explícito transacional, com transição compatível,
controle de todos os escritores e protocolo administrativo de privilégios.
Isso muda a semântica de revogação e depende de investigação e revisão antes
de qualquer implementação. A 1025 permanece desconectada; não há liberação.
