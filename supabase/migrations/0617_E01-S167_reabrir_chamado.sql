-- ADR-0391: reabertura gerencial auditada, sem alterar OS.
create table pcm.sso_reabrir_chamado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_reabrir_chamado_gate enable row level security;
alter table pcm.sso_reabrir_chamado_gate force row level security;
revoke all on pcm.sso_reabrir_chamado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_reabrir_chamado_gate(id,habilitado) values(true,false);
create table pcm.sso_reaberturas_chamado (
 request_id uuid primary key,chamado_id uuid not null references pcm.chamados(id),revisao_anterior bigint not null,revisao_resultante bigint not null,
 encerrado_em_anterior timestamptz not null,encerrado_por_anterior uuid, motivo text not null check(length(btrim(motivo)) between 1 and 2000),
 payload jsonb not null,resultado jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_reaberturas_chamado enable row level security;
alter table pcm.sso_reaberturas_chamado force row level security;
revoke all on pcm.sso_reaberturas_chamado from public,anon,authenticated,service_role;
create trigger sso_reabertura_chamado_imutavel before update or delete on pcm.sso_reaberturas_chamado for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_reabrir_chamado(p_request_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_expected_revision bigint,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_chamado pcm.chamados%rowtype;v_ant pcm.sso_reaberturas_chamado%rowtype;v_payload jsonb;v_resultado jsonb;v_encerrado_em timestamptz;v_encerrado_por uuid;
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) or not coalesce((select habilitado from pcm.sso_reabrir_chamado_gate where id),false) then raise exception 'reabertura_chamado_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_expected_revision is null or p_expected_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'reabertura_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chamadoId',p_chamado_id,'expectedRevision',p_expected_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
 if not found or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_reaberturas_chamado where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 if v_chamado.sso_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_chamado.sso_encerrado_em is null or v_chamado.status='cancelado' then raise exception 'chamado_nao_reabrivel' using errcode='23514'; end if;
 v_encerrado_em:=v_chamado.sso_encerrado_em;v_encerrado_por:=v_chamado.sso_encerrado_por;
 if config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_token_encerramento_chamado(txid,chamado_id) values(pg_catalog.txid_current(),p_chamado_id);
 update pcm.chamados set sso_encerrado_em=null,sso_encerrado_por=null,updated_at=now(),updated_by=v_actor where id=p_chamado_id returning * into v_chamado;
 delete from pcm.sso_token_encerramento_chamado where txid=pg_catalog.txid_current() and chamado_id=p_chamado_id;
 v_resultado:=jsonb_build_object('chamadoId',p_chamado_id,'revision',v_chamado.sso_revisao,'state','reaberto','osAlteradas',false,'requestId',p_request_id);
 insert into pcm.sso_reaberturas_chamado(request_id,chamado_id,revisao_anterior,revisao_resultante,encerrado_em_anterior,encerrado_por_anterior,motivo,payload,resultado,ator_id) values(p_request_id,p_chamado_id,p_expected_revision,v_chamado.sso_revisao,v_encerrado_em,v_encerrado_por,btrim(p_motivo),v_payload,v_resultado,v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'chamado.reabertura_explicita','chamados',p_chamado_id,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_reabrir_chamado(uuid,uuid,uuid,bigint,text) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_reabertura_chamado(p_cliente_id uuid,p_chamado_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_chamado pcm.chamados%rowtype;
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) or not coalesce((select habilitado from pcm.sso_reabrir_chamado_gate where id),false) then raise exception 'reabertura_chamado_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('chamadoId',p_chamado_id,'revision',v_chamado.sso_revisao,'status',v_chamado.status,'encerradoEm',v_chamado.sso_encerrado_em,'reabrivel',v_chamado.sso_encerrado_em is not null and v_chamado.status<>'cancelado');
end; $$;
revoke all on function pcm.sso_consultar_reabertura_chamado(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_reaberturas_chamado(p_cliente_id uuid,p_chamado_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,revisao_anterior bigint,revisao_resultante bigint,encerrado_em_anterior timestamptz,encerrado_por_anterior uuid,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_encerramento_chamado_gate where id),false) or not coalesce((select habilitado from pcm.sso_reabrir_chamado_gate where id),false) then raise exception 'reabertura_chamado_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select r.request_id,r.revisao_anterior,r.revisao_resultante,r.encerrado_em_anterior,r.encerrado_por_anterior,r.motivo,r.ator_id,r.criado_em from pcm.sso_reaberturas_chamado r where r.chamado_id=p_chamado_id and (p_apos is null or r.request_id>p_apos) order by r.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_reaberturas_chamado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
