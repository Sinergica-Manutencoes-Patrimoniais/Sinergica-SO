-- ADR-0396: snapshot auditado de composição; não autoriza envio.
create table pcm.visita_composicao_conferencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.visita_composicao_conferencia_gate(id,habilitado) values(true,false);
alter table pcm.visita_composicao_conferencia_gate enable row level security;
alter table pcm.visita_composicao_conferencia_gate force row level security;
revoke all on pcm.visita_composicao_conferencia_gate from public,anon,authenticated,service_role;
create table pcm.visita_composicao_conferencias(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),visita_id uuid not null references pcm.visitas(id),
  revisao_visita integer not null check(revisao_visita>0),snapshot jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table pcm.visita_composicao_conferencias enable row level security;
alter table pcm.visita_composicao_conferencias force row level security;
revoke all on pcm.visita_composicao_conferencias from public,anon,authenticated,service_role;
create trigger visita_composicao_conferencia_imutavel before update or delete on pcm.visita_composicao_conferencias for each row execute function pcm.sso_os_rotina_vinculo_imutavel();
create function pcm.sso_snapshot_composicao_visita(p_visita_id uuid,p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_os jsonb; v_equipe jsonb; v_count_os integer; v_count_equipe integer;
begin
  select count(*) into v_count_os from pcm.visita_ordens_servico vo where vo.visita_id=p_visita_id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null;
  select count(*) into v_count_equipe from pcm.visita_equipes ve where ve.visita_id=p_visita_id and ve.cliente_id=p_cliente_id and ve.encerrado_em is null;
  if v_count_os>100 or v_count_equipe>100 then raise exception 'composicao_excede_limite' using errcode='54000'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('vinculoId',vo.id,'osId',vo.os_id,'sequencia',vo.sequencia,'estimativaMinutos',vo.estimativa_minutos,
    'status',o.status,'excluidaEm',o.deleted_at) order by vo.id),'[]'::jsonb) into v_os
    from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id
    where vo.visita_id=p_visita_id and vo.cliente_id=p_cliente_id and vo.encerrado_em is null;
  select coalesce(jsonb_agg(jsonb_build_object('vinculoId',ve.id,'funcionarioId',ve.funcionario_id,'papel',ve.papel,'estimativaMinutos',ve.estimativa_minutos,
    'ativo',f.ativo,'excluidoEm',f.deleted_at) order by ve.id),'[]'::jsonb) into v_equipe
    from pcm.visita_equipes ve join pcm.funcionarios f on f.id=ve.funcionario_id where ve.visita_id=p_visita_id and ve.cliente_id=p_cliente_id and ve.encerrado_em is null;
  if jsonb_array_length(v_os)<>v_count_os or jsonb_array_length(v_equipe)<>v_count_equipe then raise exception 'composicao_incompleta' using errcode='23514'; end if;
  return jsonb_build_object('ordens',v_os,'equipe',v_equipe);
end $$;
revoke all on function pcm.sso_snapshot_composicao_visita(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_previa_composicao_visita(p_cliente_id uuid,p_visita_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v pcm.visitas%rowtype; anterior pcm.visita_composicao_conferencias%rowtype; v_snapshot jsonb; v_estado text;
begin
  if auth.uid() is null or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
    or not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_snapshot:=pcm.sso_snapshot_composicao_visita(v.id,v.cliente_id);
  select * into anterior from pcm.visita_composicao_conferencias where visita_id=v.id and cliente_id=v.cliente_id
    and revisao_visita=case when v.estado='confirmada' then v.revisao-1 else v.revisao end order by criado_em desc,id desc limit 1;
  v_estado:=case when anterior.id is null then 'nao_conferida' when anterior.snapshot is distinct from v_snapshot then 'alterada' else 'equivalente' end;
  return jsonb_build_object('visitaId',v.id,'revision',v.revisao,'estadoVisita',v.estado,'snapshot',v_snapshot,'situacao',v_estado,'autorizaEnvio',false);
end $$;
revoke all on function pcm.sso_previa_composicao_visita(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_conferir_composicao_visita(p_request_id uuid,p_cliente_id uuid,p_visita_id uuid,p_revisao integer,p_snapshot jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v pcm.visitas%rowtype; anterior pcm.visita_composicao_conferencias%rowtype; atual jsonb;
begin
  if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_visita_id is null or p_revisao is null or p_revisao<1 or p_snapshot is null
    or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.visita_composicao_conferencia_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-composicao:'||p_request_id::text,0));
  select * into v from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id for update;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into anterior from pcm.visita_composicao_conferencias where id=p_request_id;
  if found then
    if anterior.ator_id is distinct from auth.uid() or anterior.cliente_id<>p_cliente_id or anterior.visita_id<>p_visita_id or anterior.revisao_visita<>p_revisao or anterior.snapshot is distinct from p_snapshot then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'visitaId',p_visita_id,'revision',p_revisao,'state','composicao_conferida_sem_envio');
  end if;
  if v.estado<>'planejada' or v.revisao<>p_revisao then raise exception 'visita_obsoleta' using errcode='40001'; end if;
  perform vo.id from pcm.visita_ordens_servico vo join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id
    where vo.visita_id=v.id and vo.cliente_id=v.cliente_id and vo.encerrado_em is null order by vo.id for share of vo,o;
  perform ve.id from pcm.visita_equipes ve join pcm.funcionarios f on f.id=ve.funcionario_id
    where ve.visita_id=v.id and ve.cliente_id=v.cliente_id and ve.encerrado_em is null order by ve.id for share of ve,f;
  atual:=pcm.sso_snapshot_composicao_visita(v.id,v.cliente_id);
  if atual is distinct from p_snapshot then raise exception 'composicao_obsoleta' using errcode='40001'; end if;
  if jsonb_array_length(atual->'ordens')=0 or jsonb_array_length(atual->'equipe')=0 then raise exception 'composicao_incompleta' using errcode='23514'; end if;
  insert into pcm.visita_composicao_conferencias(id,cliente_id,visita_id,revisao_visita,snapshot,ator_id) values(p_request_id,p_cliente_id,v.id,v.revisao,atual,auth.uid());
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'visita.composicao_conferida','visitas',v.id,
    jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'revision',v.revisao,'quantidadeOs',jsonb_array_length(atual->'ordens'),'quantidadeEquipe',jsonb_array_length(atual->'equipe')));
  return jsonb_build_object('requestId',p_request_id,'visitaId',v.id,'revision',v.revisao,'state','composicao_conferida_sem_envio');
end $$;
revoke all on function pcm.sso_conferir_composicao_visita(uuid,uuid,uuid,integer,jsonb) from public,anon,authenticated,service_role;
