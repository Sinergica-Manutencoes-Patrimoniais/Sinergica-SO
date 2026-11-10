-- ADR-1480: origem explícita; não comprova equivalência com PMOC.
create table pcm.sso_origem_rotina_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_origem_rotina_gate(id,habilitado) values(true,false);
alter table pcm.sso_origem_rotina_gate enable row level security;
alter table pcm.sso_origem_rotina_gate force row level security;
revoke all on pcm.sso_origem_rotina_gate from public,anon,authenticated,service_role;
create table pcm.sso_origem_rotina_comandos(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null,
 plano_id uuid not null references pcm.planos_manutencao(id),versao_id uuid not null references pcm.plano_versoes(id),
 rotina_id uuid not null references pcm.rotinas_manutencao(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_origem_rotina_comandos enable row level security;
alter table pcm.sso_origem_rotina_comandos force row level security;
revoke all on pcm.sso_origem_rotina_comandos from public,anon,authenticated,service_role;
create trigger sso_origem_rotina_comandos_imutavel before update or delete on pcm.sso_origem_rotina_comandos for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_contexto_origem_rotina(p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_snapshot jsonb;v_rotina jsonb;v_n integer;v_tipo text;v_alvo uuid;v_logica uuid;v_origem text;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_plano is null or p_versao is null or p_rotina is null or p_revisao is null or p_revisao<1 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_origem_rotina_gate where id and habilitado for share;
 if not found then raise exception 'origem_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_plano.revisao<>p_revisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select snapshot into v_snapshot from pcm.plano_versoes where id=p_versao and plano_id=p_plano and estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'versao_indisponivel' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where item->>'id'=p_rotina::text;
 if v_n<>1 then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
 v_tipo:=v_rotina->>'alvo_tipo';v_logica:=(v_rotina->>'rotina_logica_id')::uuid;
 v_alvo:=case v_tipo when 'sistema' then (v_rotina->>'sistema_id')::uuid when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;
 if v_tipo is null or v_tipo not in ('sistema','componente','grupo') or v_alvo is null or v_logica is null then raise exception 'alvo_indisponivel' using errcode='23514'; end if;
 select origem into v_origem from pcm.rotina_origem_geracao where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo;
 return jsonb_build_object('planoId',p_plano,'versaoId',p_versao,'rotinaId',p_rotina,'revisao',p_revisao,'rotinaLogicaId',v_logica,'alvoTipo',v_tipo,'alvoId',v_alvo,'origem',v_origem,'exclusividadePmocComprovada',false);
end; $$;
revoke all on function pcm.sso_contexto_origem_rotina(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_origem_rotina(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r jsonb;
begin
 r:=pcm.sso_contexto_origem_rotina(p_ator_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision);
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return r;
end; $$;
revoke all on function pcm.sso_consultar_origem_rotina(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_origem_rotina(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;

create function pcm.sso_declarar_origem_rotina(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_origem text,p_motivo text,p_confirma boolean)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_origem_rotina_comandos%rowtype;v_contexto jsonb;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');v_origem text;
begin
 if p_request_id is null or p_origem is null or p_origem not in ('plano','pmoc') or v_motivo is null or length(v_motivo)>2000 or p_confirma is distinct from true then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id then raise exception 'sem_acesso' using errcode='42501'; end if;
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_origem_rotina_gate where id and habilitado for share;
 if not found then raise exception 'origem_desabilitada' using errcode='55000'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-origem-rotina:'||p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'expectedRevision',p_expected_revision,'origem',p_origem,'motivo',v_motivo,'confirma',p_confirma);
 select * into v_ant from pcm.sso_origem_rotina_comandos where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_ant.resultado;
 end if;
 v_contexto:=pcm.sso_contexto_origem_rotina(p_ator_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision);
 insert into pcm.rotina_origem_geracao(rotina_logica_id,alvo_tipo,alvo_id,origem)
 values((v_contexto->>'rotinaLogicaId')::uuid,v_contexto->>'alvoTipo',(v_contexto->>'alvoId')::uuid,p_origem)
 on conflict(rotina_logica_id,alvo_tipo,alvo_id) do nothing;
 select origem into v_origem from pcm.rotina_origem_geracao where rotina_logica_id=(v_contexto->>'rotinaLogicaId')::uuid and alvo_tipo=v_contexto->>'alvoTipo' and alvo_id=(v_contexto->>'alvoId')::uuid;
 if v_origem is distinct from p_origem then raise exception 'origem_existente_exige_transicao' using errcode='23505'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'origem',v_origem,'exclusividadePmocComprovada',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_origem_rotina_comandos(request_id,ator_id,cliente_id,plano_id,versao_id,rotina_id,payload,resultado) values(p_request_id,p_ator_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'calendario.origem_rotina_declarada','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_origem_rotina(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,boolean) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_declarar_origem_rotina(uuid,uuid,uuid,uuid,uuid,uuid,integer,text,text,boolean) to authenticated;
