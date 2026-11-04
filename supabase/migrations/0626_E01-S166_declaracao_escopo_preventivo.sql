-- ADR-0400: declaração humana de escopo, ainda sem fechamento operacional.
create table pcm.sso_escopo_preventivo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_escopo_preventivo_gate enable row level security;
alter table pcm.sso_escopo_preventivo_gate force row level security;
revoke all on pcm.sso_escopo_preventivo_gate from public,anon,authenticated,service_role;
insert into pcm.sso_escopo_preventivo_gate(id,habilitado) values(true,false);

create table pcm.sso_declaracoes_escopo_preventivo (
 request_id uuid primary key, ocorrencia_preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),
 ocorrencia_legada_id uuid not null references pcm.ocorrencias_preventivas(id), cliente_id uuid not null,
 revisao integer not null check(revisao>0), os_ids uuid[] not null, motivo text not null,
 payload jsonb not null, resultado jsonb not null, ator_id uuid not null references auth.users(id), criado_em timestamptz not null default now(),
 unique(ocorrencia_preparada_id,revisao)
);
alter table pcm.sso_declaracoes_escopo_preventivo enable row level security;
alter table pcm.sso_declaracoes_escopo_preventivo force row level security;
revoke all on pcm.sso_declaracoes_escopo_preventivo from public,anon,authenticated,service_role;
create trigger sso_declaracao_escopo_preventivo_imutavel before update or delete on pcm.sso_declaracoes_escopo_preventivo for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_declarar_escopo_preventivo(p_request_id uuid,p_cliente_id uuid,p_ocorrencia_id uuid,p_expected_revision integer,p_os_ids uuid[],p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_legada uuid; v_rev integer; v_ids uuid[]; v_payload jsonb; v_resultado jsonb; v_ant pcm.sso_declaracoes_escopo_preventivo%rowtype; v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_escopo_preventivo_gate where id),false) then raise exception 'escopo_preventivo_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_ocorrencia_id is null or p_expected_revision is null or p_expected_revision<0 or v_motivo is null or length(v_motivo)>2000 or p_os_ids is null or cardinality(p_os_ids) not between 1 and 100 or array_position(p_os_ids,null) is not null then raise exception 'declaracao_invalida' using errcode='22023'; end if;
 select array_agg(id order by id) into v_ids from (select distinct unnest(p_os_ids) id) x;
 if cardinality(v_ids)<>cardinality(p_os_ids) then raise exception 'os_duplicada' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'ocorrenciaId',p_ocorrencia_id,'revisaoEsperada',p_expected_revision,'osIds',to_jsonb(v_ids),'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('escopo-preventivo-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_declaracoes_escopo_preventivo where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 perform 1 from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id where o.id=p_ocorrencia_id and p.cliente_id=p_cliente_id for update of o;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 select ocorrencia_legada_id into v_legada from pcm.ocorrencias_rotina_vinculos where ocorrencia_preparada_id=p_ocorrencia_id;
 if v_legada is null then raise exception 'vinculo_legado_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_declaracoes_escopo_preventivo where ocorrencia_preparada_id=p_ocorrencia_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 perform 1 from pcm.ordens_servico os where os.id=any(v_ids) order by os.id for share;
 if (select count(*) from pcm.ordens_servico os where os.id=any(v_ids) and os.client_id=p_cliente_id and os.ocorrencia_preventiva_id=v_legada and os.deleted_at is null)<>cardinality(v_ids) then raise exception 'os_incompativel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'ocorrenciaId',p_ocorrencia_id,'revisao',v_rev+1,'osDeclaradas',cardinality(v_ids),'declaracaoHumana',true,'escopoCongelado',false,'ocorrenciaConcluida',false);
 insert into pcm.sso_declaracoes_escopo_preventivo(request_id,ocorrencia_preparada_id,ocorrencia_legada_id,cliente_id,revisao,os_ids,motivo,payload,resultado,ator_id) values(p_request_id,p_ocorrencia_id,v_legada,p_cliente_id,v_rev+1,v_ids,v_motivo,v_payload,v_resultado,v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.escopo_preventivo_declarado','ocorrencias_preventivas',v_legada,v_resultado || jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_escopo_preventivo(uuid,uuid,uuid,integer,uuid[],text) from public,anon,authenticated,service_role;

create function pcm.sso_previa_escopo_preventivo(p_cliente_id uuid,p_plano_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_legada uuid; v_rev integer; v_os jsonb; v_hist jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_escopo_preventivo_gate where id),false) then raise exception 'escopo_preventivo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select v.ocorrencia_legada_id into v_legada from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id where o.id=p_ocorrencia_id and p.id=p_plano_id and p.cliente_id=p_cliente_id;
 if v_legada is null then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_declaracoes_escopo_preventivo where ocorrencia_preparada_id=p_ocorrencia_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'status',status) order by id),'[]'::jsonb) into v_os from (select id,status from pcm.ordens_servico where client_id=p_cliente_id and ocorrencia_preventiva_id=v_legada and deleted_at is null order by id limit 101) s;
 select coalesce(jsonb_agg(jsonb_build_object('requestId',request_id,'revisao',revisao,'motivo',motivo,'osIds',os_ids,'atorId',ator_id,'criadoEm',criado_em) order by revisao desc),'[]'::jsonb) into v_hist from (select request_id,revisao,motivo,os_ids,ator_id,criado_em from pcm.sso_declaracoes_escopo_preventivo where ocorrencia_preparada_id=p_ocorrencia_id order by revisao desc limit 20) h;
 return jsonb_build_object('revisao',v_rev,'os',v_os,'historicoRecente',v_hist,'historicoLimitado',v_rev>20,'escopoCongelado',false);
end; $$;
revoke all on function pcm.sso_previa_escopo_preventivo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
