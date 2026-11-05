-- ADR-0457: copia apenas propostas históricas, nunca declara reconferência automática.
create table pcm.sso_revisao_exigencias_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_revisao_exigencias_gate enable row level security;
alter table pcm.sso_revisao_exigencias_gate force row level security;
revoke all on pcm.sso_revisao_exigencias_gate from public,anon,authenticated,service_role;
insert into pcm.sso_revisao_exigencias_gate(id,habilitado) values(true,false);
create table pcm.sso_propostas_exigencia_revisao (
 id uuid primary key default gen_random_uuid(),plano_id uuid not null references pcm.planos_manutencao(id),versao_origem_id uuid not null references pcm.plano_versoes(id),versao_destino_id uuid not null references pcm.plano_versoes(id),
 rotina_origem_id uuid not null,rotina_destino_id uuid not null references pcm.rotinas_manutencao(id),origem_snapshot jsonb not null,request_revisao uuid not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),unique(versao_destino_id,rotina_destino_id)
);
create table pcm.sso_revisoes_plano_exigencias(request_id uuid primary key,plano_id uuid not null references pcm.planos_manutencao(id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_propostas_exigencia_revisao enable row level security;
alter table pcm.sso_propostas_exigencia_revisao force row level security;
alter table pcm.sso_revisoes_plano_exigencias enable row level security;
alter table pcm.sso_revisoes_plano_exigencias force row level security;
revoke all on pcm.sso_propostas_exigencia_revisao,pcm.sso_revisoes_plano_exigencias from public,anon,authenticated,service_role;
create trigger sso_proposta_exigencia_imutavel before update or delete on pcm.sso_propostas_exigencia_revisao for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_revisao_exigencia_imutavel before update or delete on pcm.sso_revisoes_plano_exigencias for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_iniciar_revisao_com_exigencias(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_nova_versao_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_origem pcm.plano_versoes%rowtype;v_ant pcm.sso_revisoes_plano_exigencias%rowtype;v_payload jsonb;v_iniciada jsonb;v_saida jsonb;v_item jsonb;v_rotina jsonb;v_destino uuid;v_num integer;v_copiadas integer:=0;v_pendentes integer:=0;
begin
 if not coalesce((select habilitado from pcm.sso_revisao_exigencias_gate where id),false) or not coalesce((select habilitado from pcm.sso_exigencia_legal_gate where id),false) then raise exception 'revisao_exigencias_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<1 or p_nova_versao_id is null then raise exception 'revisao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'expectedRevision',p_expected_revision,'novaVersaoId',p_nova_versao_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('revisao-exigencias:'||p_request_id::text,0));
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_revisoes_plano_exigencias where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 select * into v_origem from pcm.plano_versoes where plano_id=p_plano_id and estado='aprovado' order by numero desc limit 1 for update;
 if not found or jsonb_typeof(v_origem.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 v_iniciada:=pcm.sso_iniciar_revisao_plano_com_evidencias(gen_random_uuid(),p_cliente_id,p_plano_id,p_expected_revision,p_nova_versao_id);
 if jsonb_typeof(v_origem.snapshot->'exigencias_rotinas')='array' then
  for v_item in select value from jsonb_array_elements(v_origem.snapshot->'exigencias_rotinas') loop
   select count(*),min(x.item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_origem.snapshot->'rotinas') x(item) where x.item->>'id'=v_item->>'rotinaId';
   if v_num<>1 or v_rotina->>'rotina_logica_id' is null or v_item->>'classificacao' is null or v_item->>'classificacao' not in ('legal_normativa','nao_classificada','indeterminada') then v_pendentes:=v_pendentes+1;continue;end if;
   v_destino:=(v_iniciada->'linkedIds'->>('rotina:'||(v_rotina->>'rotina_logica_id')))::uuid;
   if v_destino is null then v_pendentes:=v_pendentes+1;continue;end if;
   insert into pcm.sso_propostas_exigencia_revisao(plano_id,versao_origem_id,versao_destino_id,rotina_origem_id,rotina_destino_id,origem_snapshot,request_revisao,ator_id) values(p_plano_id,v_origem.id,p_nova_versao_id,(v_rotina->>'id')::uuid,v_destino,v_item,p_request_id,v_actor);
   v_copiadas:=v_copiadas+1;
  end loop;
 else v_pendentes:=v_pendentes+1;end if;
 v_saida:=v_iniciada||jsonb_build_object('requestId',p_request_id,'exigenciasPropostas',v_copiadas,'exigenciasNaoCopiadas',v_pendentes,'reconferenciaExigenciasNecessaria',true);
 insert into pcm.sso_revisoes_plano_exigencias(request_id,plano_id,ator_id,payload,resultado) values(p_request_id,p_plano_id,v_actor,v_payload,v_saida);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.revisao_exigencias_propostas','planos_manutencao',p_plano_id,jsonb_build_object('requestId',p_request_id,'versaoId',p_nova_versao_id,'propostas',v_copiadas,'naoCopiadas',v_pendentes,'reconferenciaNecessaria',true));return v_saida;
end; $$;
revoke all on function pcm.sso_iniciar_revisao_com_exigencias(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_proposta_exigencia_revisao(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v pcm.sso_propostas_exigencia_revisao%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_revisao_exigencias_gate where id),false) then raise exception 'revisao_exigencias_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v from pcm.sso_propostas_exigencia_revisao where plano_id=p_plano_id and versao_destino_id=p_versao_id and rotina_destino_id=p_rotina_id;
 if not found then return jsonb_build_object('propostaExiste',false,'reconferenciaNecessaria',true);end if;
 return jsonb_build_object('propostaExiste',true,'versaoOrigemId',v.versao_origem_id,'classificacao',v.origem_snapshot->'classificacao','referencia',v.origem_snapshot->'referencia','justificativa',v.origem_snapshot->'justificativa','criadaEm',v.criado_em,'reconferenciaNecessaria',true,'validada',false);
end; $$;
revoke all on function pcm.sso_proposta_exigencia_revisao(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
