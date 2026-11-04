-- Somente clone descartável, migrations até 1663, em transação revertida.
-- Fonte legada e vínculo explícito referem a mesma OS; a OS divergente é apenas fixture.
\ir manual_E01-S165_S166_ponte_legada_mediada.sql
update config.sso_concessoes set ativa=true where usuario_id='16630000-1111-4000-8000-000000000001' and acao='plano.gerir';
update pcm.sso_decisao_comparada_gate set habilitado=true where id;
insert into pcm.clientes(id,nome,ativo,created_by) values ('16630000-1111-4000-8000-00000000000b','Outro cliente sintético',true,'16630000-1111-4000-8000-000000000001');
-- Replica neste bloco para construir conflito histórico de Cliente apenas na fixture.
set local session_replication_role=replica;
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id)
select '16630000-1111-4000-8000-000000000201','16630000-1111-4000-8000-00000000000a','OS-1662-1','OS autorizada fixture','preventiva','16630000-1111-4000-8000-000000000001',v.ocorrencia_legada_id
from pcm.ocorrencias_rotina_vinculos v join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.ordens_servico(id,client_id,numero,titulo,categoria,created_by,ocorrencia_preventiva_id)
select '16630000-1111-4000-8000-000000000202','16630000-1111-4000-8000-00000000000b','OS-1662-2','OS divergente fixture','preventiva','16630000-1111-4000-8000-000000000001',null
from pcm.ocorrencias_rotina_vinculos v join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.os_rotina_vinculos_explicitos(os_id,cliente_id,ocorrencia_legada_id,ocorrencia_preparada_id,plano_id,versao_id,rotina_id,alvo_tipo,alvo_id,rotina_snapshot,request_id,ator_id)
select '16630000-1111-4000-8000-000000000201','16630000-1111-4000-8000-00000000000a',v.ocorrencia_legada_id,o.id,o.plano_id,o.versao_id,o.rotina_id,o.alvo_tipo,o.alvo_id,'{}'::jsonb,'16630000-1111-4000-8000-000000000203','16630000-1111-4000-8000-000000000001'
from pcm.ocorrencias_rotina_vinculos v join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id where o.plano_id='16630000-1111-4000-8000-000000000011';
insert into pcm.os_rotina_vinculos_explicitos(os_id,cliente_id,ocorrencia_legada_id,ocorrencia_preparada_id,plano_id,versao_id,rotina_id,alvo_tipo,alvo_id,rotina_snapshot,request_id,ator_id)
select '16630000-1111-4000-8000-000000000202','16630000-1111-4000-8000-00000000000a',v.ocorrencia_legada_id,o.id,o.plano_id,o.versao_id,o.rotina_id,o.alvo_tipo,o.alvo_id,'{}'::jsonb,'16630000-1111-4000-8000-000000000205','16630000-1111-4000-8000-000000000001'
from pcm.ocorrencias_rotina_vinculos v join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id where o.plano_id='16630000-1111-4000-8000-000000000011';
set local session_replication_role=origin;
set local role authenticated;
create temporary table os_comparacao_1662 as select pcm.sso_comparar_rotina_impacto_v3('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000022',(select preparada_id from pcm.sso_listar_decisoes_calendario_mediada('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,null,20)),'calendario') foto;
do $$ declare f jsonb;begin
 select foto into f from os_comparacao_1662;
 if jsonb_array_length(f->'osImpacto')<>1 or f->'osImpacto'->0->>'id' is distinct from '16630000-1111-4000-8000-000000000201' or f->>'osOutroCliente' is distinct from 'true' then raise exception 'os_ou_deduplicacao_divergente: %',f;end if;
 if f::text like '%16630000-1111-4000-8000-000000000202%' or f::text like '%OS divergente fixture%' then raise exception 'dados_os_outro_cliente_expostos';end if;
end; $$;
reset role;
set local session_replication_role=replica;
update pcm.ordens_servico set status='em_execucao',updated_at=now()+interval '1 second' where id='16630000-1111-4000-8000-000000000201';
set local session_replication_role=origin;
set local role authenticated;
do $$ declare f jsonb;p uuid;begin
 select foto,(foto->>'preparadaId')::uuid into f,p from os_comparacao_1662;
 begin
  perform pcm.sso_decidir_impacto_comparado('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-000000000204','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011','16630000-1111-4000-8000-000000000022',p,2,1,'exige_reconciliacao','conferido','calendario',f);
  raise exception 'status_obsoleto_aceito';
 exception when serialization_failure then if sqlerrm<>'comparacao_obsoleta' then raise;end if;end;
 f:=pcm.sso_comparar_rotina_impacto_v3('16630000-1111-4000-8000-000000000001','16630000-1111-4000-8000-00000000000a','16630000-1111-4000-8000-000000000011',2,'16630000-1111-4000-8000-000000000022',p,'calendario');
 if f->'osImpacto'->0->>'status' is distinct from 'em_execucao' then raise exception 'status_atual_nao_mostrado';end if;
end; $$;
reset role;
do $$ begin
 if (select count(*) from pcm.sso_decisoes_impacto_ocorrencia where plano_id='16630000-1111-4000-8000-000000000011')<>1 then raise exception 'decisao_obsoleta_persistiu';end if;
end; $$;
