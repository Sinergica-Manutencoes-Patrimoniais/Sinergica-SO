-- ADR-1437: uma OS local por intenção, com decisão e vínculo na mesma transação.
create table pcm.sso_criacoes_os_grupo (
 request_id uuid primary key, cliente_id uuid not null references pcm.clientes(id),
 intencao_id uuid not null unique references pcm.sso_intencoes_os_grupo(id),
 os_id uuid not null unique references pcm.ordens_servico(id), ator_id uuid not null references auth.users(id),
 payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table pcm.sso_criacoes_os_grupo enable row level security;
alter table pcm.sso_criacoes_os_grupo force row level security;
revoke all on pcm.sso_criacoes_os_grupo from public,anon,authenticated,service_role;
create trigger sso_criacao_os_grupo_imutavel before update or delete on pcm.sso_criacoes_os_grupo
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

create or replace function pcm.sso_criar_os_grupo(p_request_id uuid,p_cliente_id uuid,p_intencao_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
 v_ator uuid:=auth.uid(); v_int pcm.sso_intencoes_os_grupo%rowtype; v_oc pcm.sso_ocorrencias_grupo%rowtype;
 v_ant pcm.sso_criacoes_os_grupo%rowtype; v_snapshot jsonb; v_itens jsonb; v_tipo uuid; v_questionario uuid;
 v_os uuid; v_payload jsonb; v_resultado jsonb; v_sync_anterior text;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_criacao_os_grupo_gate where id and habilitado for share;
 if not found then raise exception 'criacao_os_grupo_bloqueada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_intencao_id is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'intencaoId',p_intencao_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('criar-os-grupo:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_criacoes_os_grupo where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 -- Nunca cria OS se o antigo disparador automático de tarefa estiver ativo.
 if exists(select 1 from pg_catalog.pg_trigger where tgrelid='pcm.ordens_servico'::regclass
   and tgname='trg_auvo_create_task_on_planejamento' and not tgisinternal and tgenabled<>'D') then
   raise exception 'disparo_auvo_legado_ativo' using errcode='55000'; end if;
 select * into v_int from pcm.sso_intencoes_os_grupo where id=p_intencao_id and cliente_id=p_cliente_id;
 if not found then raise exception 'intencao_indisponivel' using errcode='42501'; end if;
 select * into v_oc from pcm.sso_ocorrencias_grupo where id=v_int.ocorrencia_grupo_id and cliente_id=p_cliente_id for update;
 if not found or exists(select 1 from pcm.sso_vinculos_os_grupo where ocorrencia_grupo_id=v_int.ocorrencia_grupo_id)
   or exists(select 1 from pcm.sso_decisoes_intencao_grupo where intencao_id=p_intencao_id)
   or exists(select 1 from pcm.sso_criacoes_os_grupo where intencao_id=p_intencao_id) then
   raise exception 'ocorrencia_ou_intencao_indisponivel' using errcode='23514'; end if;
 select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id
   where v.id=v_oc.versao_id and v.plano_id=v_oc.plano_id and v.estado='aprovado' and p.cliente_id=p_cliente_id and p.estado in ('aprovado','ativo') for share of v,p;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select jsonb_agg(r) into v_itens from jsonb_array_elements(v_snapshot->'rotinas') r
   where r->>'id'=v_oc.rotina_id::text and r->>'alvo_tipo'='grupo' and r->>'grupo_id'=v_oc.grupo_id::text;
 if v_itens is null or jsonb_array_length(v_itens)<>1 or v_itens->0 is distinct from v_int.rotina_snapshot
   or v_int.quantidade_snapshot is distinct from v_oc.quantidade_snapshot or v_int.grupo_revisao is distinct from v_oc.grupo_revisao then
   raise exception 'fotografia_divergente' using errcode='23514'; end if;
 v_tipo:=pcm.sso_tipo_tarefa_snapshot(v_itens->0);
 v_questionario:=nullif(v_itens->0->>'questionario_id','')::uuid;
 if v_tipo is not null and not exists(select 1 from pcm.tipos_tarefa where id=v_tipo and ativo and deleted_at is null) then raise exception 'tipo_tarefa_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_os:=gen_random_uuid();
 v_sync_anterior:=current_setting('app.auvo_sync_write',true);
 perform pg_catalog.set_config('app.auvo_sync_write','true',true);
 insert into pcm.ordens_servico(id,numero,client_id,titulo,descricao,categoria,status,prioridade,origem,created_by,tipo_os,tipo_tarefa_id,questionario_id)
 values(v_os,'PRE-'||upper(replace(v_os::text,'-','')),p_cliente_id,v_int.titulo,
   'Preventiva de Grupo Quantitativo; quantidade histórica: '||v_int.quantidade_snapshot::text,
   'preventiva','planejamento','normal','preventiva_pcm',v_ator,'P2',v_tipo,v_questionario);
 perform pcm.sso_decidir_vinculo_intencao_grupo(gen_random_uuid(),p_cliente_id,p_intencao_id,v_os,v_int.motivo);
 perform pcm.sso_declarar_vinculo_os_grupo(gen_random_uuid(),p_cliente_id,v_oc.id,v_os,v_int.motivo);
 perform pg_catalog.set_config('app.auvo_sync_write',coalesce(v_sync_anterior,''),true);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'intencaoId',p_intencao_id,'ocorrenciaId',v_oc.id,'osId',v_os,'osCriada',true,'tarefaCriada',false);
 insert into pcm.sso_criacoes_os_grupo(request_id,cliente_id,intencao_id,os_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_intencao_id,v_os,v_ator,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'calendario.os_grupo_criada','ordens_servico',v_os,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_criar_os_grupo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_criar_os_grupo(uuid,uuid,uuid) to authenticated;
