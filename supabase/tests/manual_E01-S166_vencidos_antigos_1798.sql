-- Fixture sintética 1798: clone descartável; psql ON_ERROR_STOP; sem alterar snapshot após inserção.
begin;
set local app.auvo_sync_write='true';
create temporary table baseline_fuso_1666 as select count(*) total from pcm.auvo_sync_outbox;
select set_config('sso.fixture.fuso',case when (transaction_timestamp() at time zone 'Pacific/Kiritimati')::date<>(transaction_timestamp() at time zone 'America/Sao_Paulo')::date then 'Pacific/Kiritimati' else 'Etc/GMT+12' end,true);
select set_config('sso.fixture.hoje',(transaction_timestamp() at time zone current_setting('sso.fixture.fuso'))::date::text,true);
select set_config('sso.fixture.sp',(transaction_timestamp() at time zone 'America/Sao_Paulo')::date::text,true);
do $$ begin if current_setting('sso.fixture.hoje')=current_setting('sso.fixture.sp') then raise exception 'fixture_fusos_nao_divergem';end if;end; $$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('16660000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','fuso-1666@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('16660000-0000-4000-8000-000000000001','colaborador','Fixture fuso',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('16660000-0000-4000-8000-000000000001','pcm','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('16660000-0000-4000-8000-00000000000a','Cliente fuso',true,'16660000-0000-4000-8000-000000000001');
insert into config.sso_concessoes(usuario_id,acao,cliente_id) values ('16660000-0000-4000-8000-000000000001','plano.gerir','16660000-0000-4000-8000-00000000000a');
insert into pcm.sistemas(id,cliente_id,nome) values ('16660000-0000-4000-8000-000000000033','16660000-0000-4000-8000-00000000000a','Sistema fuso');
insert into pcm.planos_manutencao(id,cliente_id,nome,estado,created_by) values ('16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-00000000000a','Plano fuso','aprovado','16660000-0000-4000-8000-000000000001');
insert into pcm.plano_versoes(id,plano_id,numero,estado,vigencia_inicio,snapshot,created_by)
values ('16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000011',1,'aprovado',current_setting('sso.fixture.sp')::date-400,
 jsonb_build_object('fuso_plano',jsonb_build_object('fuso','America/Sao_Paulo','vigenciaInicio',(current_setting('sso.fixture.sp')::date-400)::text),
 'rotinas',jsonb_build_array(jsonb_build_object('id','16660000-0000-4000-8000-000000000031','rotina_logica_id','16660000-0000-4000-8000-000000000032','alvo_tipo','sistema','sistema_id','16660000-0000-4000-8000-000000000033','modo','calendario','data_base',(current_setting('sso.fixture.sp')::date-400)::text,'intervalo_n',1,'intervalo_unidade','dias','tolerancia_antes',0,'tolerancia_depois',0))),
 '16660000-0000-4000-8000-000000000001');
insert into pcm.rotinas_manutencao(id,rotina_logica_id,plano_id,versao_id,nome,alvo_tipo,sistema_id,modo,intervalo_n,intervalo_unidade,data_base,created_by) values ('16660000-0000-4000-8000-000000000031','16660000-0000-4000-8000-000000000032','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','Rotina fuso','sistema','16660000-0000-4000-8000-000000000033','calendario',1,'dias',current_setting('sso.fixture.sp')::date-400,'16660000-0000-4000-8000-000000000001');
update pcm.plano_transicao_gate set habilitado=true where id;
set local request.jwt.claims='{"sub":"16660000-0000-4000-8000-000000000001","role":"authenticated","user_role":"colaborador"}';
-- Origem e gates sintéticos: mesmos pré-requisitos da fixture de retomada.
insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem)
values ('16660000-0000-4000-8000-000000000032','sistema','16660000-0000-4000-8000-000000000033','plano');
update pcm.sso_preparar_ciclo_vencido_gate set habilitado=true where id;
update pcm.sso_materializar_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_identidade_ciclo_gate set habilitado=true where id;
update pcm.ocorrencia_rotina_gate set habilitado=true where id;
update pcm.sso_guarda_ciclo_canonico_gate set habilitado=true where id;
update pcm.sso_concorrencia_impacto_gate set habilitado=true where id;
update pcm.sso_pmoc_mediado_gate set habilitado=true where id;
update pcm.sso_diagnostico_pmoc_gate set habilitado=true where id;
update pcm.sso_decisao_pmoc_gate set habilitado=true where id;
update pcm.sso_vinculo_ciclo_pmoc_gate set habilitado=true where id;
update pcm.sso_origem_lote_gate set habilitado=true where id;
update pcm.sso_origem_rotina_gate set habilitado=true where id;
update pcm.sso_data_civil_geracao_gate set habilitado=true where id;
update pcm.sso_snapshot_fuso_plano_gate set habilitado=true where id;
create temporary table fixture1798_baseline as
select snapshot, (select count(*) from pcm.ordens_servico) os,
  (select count(*) from pcm.auvo_sync_outbox) outbox
from pcm.plano_versoes where id='16660000-0000-4000-8000-000000000021';
set local role authenticated;
do $$
declare a jsonb; b jsonb; repeticao jsonb; hoje date:=current_setting('sso.fixture.sp')::date;
begin
  a:=pcm.sso_preparar_ciclo_vencido('17980000-0000-4000-8000-000000000001','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',1,hoje-366);
  b:=pcm.sso_preparar_ciclo_vencido('17980000-0000-4000-8000-000000000002','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',1,hoje-367);
  repeticao:=pcm.sso_preparar_ciclo_vencido('17980000-0000-4000-8000-000000000002','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',1,hoje-367);
  if b is distinct from repeticao or a->>'preparadaId'=b->>'preparadaId' or
    (a->>'vencimentoOriginal')::date<>hoje-366 or (b->>'vencimentoOriginal')::date<>hoje-367 or
    a->>'osCriada'<>'false' or b->>'tarefaAuvoCriada'<>'false' then raise exception 'fronteira_ou_replay_divergente'; end if;
  begin
    perform pcm.sso_preparar_ciclo_vencido('17980000-0000-4000-8000-000000000003','16660000-0000-4000-8000-00000000000a','16660000-0000-4000-8000-000000000011','16660000-0000-4000-8000-000000000021','16660000-0000-4000-8000-000000000031',1,hoje);
    raise exception 'hoje_aceito_como_vencido';
  exception when invalid_parameter_value then if sqlerrm<>'vencimento_fora_da_janela' then raise; end if; end;
end $$;
reset role;
do $$ begin
  if (select snapshot from fixture1798_baseline) is distinct from (select snapshot from pcm.plano_versoes where id='16660000-0000-4000-8000-000000000021') or
    (select os from fixture1798_baseline)<>(select count(*) from pcm.ordens_servico) or
    (select outbox from fixture1798_baseline)<>(select count(*) from pcm.auvo_sync_outbox) or
    (select count(*) from pcm.ocorrencias_rotina_preparadas where plano_id='16660000-0000-4000-8000-000000000011')<>2 then
    raise exception 'snapshot_ou_efeitos_divergentes'; end if;
end $$;
rollback;
