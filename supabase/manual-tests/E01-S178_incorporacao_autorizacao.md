---
name: "supabase-manual-tests-e01-s178-incorporacao-autorizacao-md"
description: "Documento Sinérgica SO: S178 — autorização concorrente durante incorporação real"
alwaysApply: false
---

# S178 — autorização concorrente durante incorporação real

Somente banco descartável em rede interna e cron desligado. Usar duas sessões psql. A fixture `E01-S177_snapshot_fixture.sql` deve ter sido criada; também é necessária concessão **sintética e previamente confirmada** `cadastro.aprovar` ao usuário `17799500-0000-0000-0000-000000000001` para o Cliente `...000a`. Não inserir concessão dentro da sessão A: seu trigger tomaria a trava exclusiva e falsearia a prova. Aplicar 1017 apenas transacionalmente antes de iniciar a operação.

Sessão A, após `begin`, `set local app.auvo_sync_write='true'` e aplicação transacional de 1017:

```sql
set local request.jwt.claims='{"sub":"17799500-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';
insert into pcm.areas(id,cliente_id,nome) values ('17799500-0000-0000-0000-000000000061','17799500-0000-0000-0000-00000000000a','Área sintética');
insert into pcm.locais(id,area_id,nome) values ('17799500-0000-0000-0000-000000000062','17799500-0000-0000-0000-000000000061','Local sintético');
update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;
update pcm.sso_conferencia_lote_gate set habilitado=true where id;
update pcm.sso_incorporacao_aprovacao_gate set habilitado=true where id;
update pcm.sso_levantamento_ativos_gate set habilitado=true where chave;
update pcm.sso_validar_atributos_ativo_importado_gate set habilitado=true where id;
select pcm.sso_receber_levantamento_manual('17799500-0000-0000-0000-000000000063','17799500-0000-0000-0000-00000000000a','planilha','s178-aprovado-1017','[{"chave":"sistema","tipo":"sistema","atributos":{"nome":"Sistema sintético"}}]'::jsonb)->>'aggregateId' as lote \gset
select pcm.sso_registrar_conferencia_linha('17799500-0000-0000-0000-000000000064',:'lote',1,'sistema','{"nome":"Sistema sintético"}'::jsonb);
select pcm.sso_concluir_conferencia_lote('17799500-0000-0000-0000-000000000065',:'lote',2);
set local role authenticated;
select pcm.sso_incorporar_ativo_autorizado('17799500-0000-0000-0000-000000000066',:'lote',3,'sistema','17799500-0000-0000-0000-000000000062',null,null,null,'S178-SISTEMA-1017',null,0);
```

O último comando deve incorporar e retornar revisão 4. Manter A aberta. Sessão B:

```sql
begin;
update config.sso_concessoes set ativa=false
 where usuario_id='17799500-0000-0000-0000-000000000001'
   and acao='cadastro.aprovar' and cliente_id='17799500-0000-0000-0000-00000000000a';
-- Deve aguardar a conclusão da transação A.
```

Reverter A; B deve prosseguir com `UPDATE 1` e depois ser revertida. Nenhum lote, sistema, alteração de gate ou revogação permanece. O teste foi realizado nessa ordem em 2026-10-30; não demonstra commit, outras entidades, nem os demais mediadores. A concessão sintética prévia permanece somente na base de diagnóstico. Não aciona serviço externo.

Em 2026-10-30, o teste independente `supabase/tests/E01-S178_incorporacao_revogacao_sequencial.test.sql` confirmou em rollback incorporações positivas de Sistema, Componente e Grupo, replay sem duplicação, conflitos de payload/revisão, negação de usuário sem concessão e recusa de novas linhas após revogar `cadastro.aprovar` (16/16). O teste é sequencial e não comprova corrida entre sessões para todos os tipos.
