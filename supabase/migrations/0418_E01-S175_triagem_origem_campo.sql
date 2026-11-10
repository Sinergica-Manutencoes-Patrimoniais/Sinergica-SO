-- ADR-0192: triagem privada, sem conceder execução.
create table pcm.sso_origem_campo_triagem_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_origem_campo_triagem_gate(id,habilitado) values(true,false);
alter table pcm.sso_origem_campo_triagem_gate enable row level security;
alter table pcm.sso_origem_campo_triagem_gate force row level security;
revoke all on pcm.sso_origem_campo_triagem_gate from public,anon,authenticated,service_role;
create table pcm.sso_origem_campo_triagens(envelope_id uuid primary key references pcm.origem_campo_inbox(id),cliente_id uuid not null references pcm.clientes(id),motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),request_id uuid not null unique,criado_em timestamptz not null default now());
alter table pcm.sso_origem_campo_triagens enable row level security;
alter table pcm.sso_origem_campo_triagens force row level security;
revoke all on pcm.sso_origem_campo_triagens from public,anon,authenticated,service_role;

create function config.sso_autorizar_triagem_global() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(exists(select 1 from config.usuarios u join config.sso_acoes a on a.codigo='integracao.reconciliar'
    where u.user_id=auth.uid() and u.ativo and u.papel=auth.jwt()->>'user_role' and u.papel<>'cliente-sindico'
      and (u.papel='superadmin' or exists(select 1 from config.sso_acao_modulos am join config.resolver_permissoes_modulo(u.user_id) m on m.modulo=am.modulo where am.acao=a.codigo and (m.nivel='escrita' or am.nivel='leitura')))
      and exists(select 1 from config.sso_concessoes g where g.ativa and g.acao=a.codigo and g.cliente_id is null
        and (g.usuario_id=u.user_id or (not a.exige_concessao_individual and g.perfil_id is not null and exists(select 1 from config.sso_usuario_perfis up join config.sso_perfis p on p.id=up.perfil_id and p.ativo where up.usuario_id=u.user_id and up.perfil_id=g.perfil_id and up.ativo))))),false);
$$;
revoke all on function config.sso_autorizar_triagem_global() from public,anon,authenticated,service_role;
create function pcm.sso_listar_triagem_origem_campo(p_apos uuid,p_limite integer)
returns table(id uuid,integracao text,task_id bigint,cliente_externo_id text,recebido_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_triagem_global() is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select i.id,i.integracao,i.task_id,i.cliente_externo_id,i.recebido_em from pcm.origem_campo_inbox i
    where (p_apos is null or i.id>p_apos) and not exists(select 1 from pcm.sso_origem_campo_triagens t where t.envelope_id=i.id)
      and not exists(select 1 from pcm.origem_campo_resolucoes r where r.envelope_id=i.id and r.resultado='os_identificada')
    order by i.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_triagem_origem_campo(uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_indicar_cliente_origem_campo(p_request_id uuid,p_envelope_id uuid,p_cliente_id uuid,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid(); v_anterior pcm.sso_origem_campo_triagens%rowtype; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_origem_campo_triagem_gate where id),false) then raise exception 'triagem_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_envelope_id is null or p_cliente_id is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_triagem_global() is not true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('triagem-origem:'||p_request_id::text,0));
  select * into v_anterior from pcm.sso_origem_campo_triagens where request_id=p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.envelope_id is distinct from p_envelope_id or v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('envelopeId',p_envelope_id,'clienteId',p_cliente_id,'requestId',p_request_id,'eventoAplicado',false);
  end if;
  perform 1 from pcm.origem_campo_inbox where id=p_envelope_id for update;
  if not found or exists(select 1 from pcm.sso_origem_campo_triagens where envelope_id=p_envelope_id) or exists(select 1 from pcm.origem_campo_resolucoes where envelope_id=p_envelope_id and resultado='os_identificada') then raise exception 'envelope_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_triagem_global() is not true or config.sso_autorizar_acao('integracao.reconciliar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_origem_campo_triagens(envelope_id,cliente_id,motivo,ator_id,request_id) values(p_envelope_id,p_cliente_id,btrim(p_motivo),v_ator,p_request_id);
  v_resultado:=jsonb_build_object('envelopeId',p_envelope_id,'clienteId',p_cliente_id,'requestId',p_request_id,'eventoAplicado',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'origem_campo.cliente_indicado','origem_campo_inbox',p_envelope_id,v_resultado||jsonb_build_object('motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_indicar_cliente_origem_campo(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
