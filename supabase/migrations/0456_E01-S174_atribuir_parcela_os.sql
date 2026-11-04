-- ADR-0230: atribuição privada, não executa nem envia tarefa.
create table pcm.sso_atribuicao_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_atribuicao_parcela_gate(id,habilitado) values(true,false);
create table pcm.sso_atribuicoes_parcela(parcela_id uuid primary key references pcm.chamado_escopo_parcelas(id),os_id uuid not null references pcm.ordens_servico(id),chamado_id uuid not null references pcm.chamados(id),cliente_id uuid not null references pcm.clientes(id),ator_id uuid not null references auth.users(id),request_id uuid not null unique,payload jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_atribuicao_parcela_gate enable row level security;alter table pcm.sso_atribuicao_parcela_gate force row level security;
alter table pcm.sso_atribuicoes_parcela enable row level security;alter table pcm.sso_atribuicoes_parcela force row level security;
revoke all on pcm.sso_atribuicao_parcela_gate,pcm.sso_atribuicoes_parcela from public,anon,authenticated,service_role;
create function pcm.sso_atribuir_parcela_os(p_request_id uuid,p_parcela_id uuid,p_os_id uuid,p_chamado_revision bigint,p_escopo_revision bigint,p_os_status text,p_os_atualizada_em timestamptz,p_motivo text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_parcela pcm.chamado_escopo_parcelas%rowtype;v_chamado pcm.chamados%rowtype;v_escopo pcm.chamado_escopo_composicoes%rowtype;v_os pcm.ordens_servico%rowtype;v_a pcm.sso_atribuicoes_parcela%rowtype;v_payload jsonb;v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.sso_atribuicao_parcela_gate where id),false) then raise exception 'atribuicao_desabilitada' using errcode='55000'; end if;
  if v_ator is null or p_request_id is null or p_parcela_id is null or p_os_id is null or p_chamado_revision is null or p_chamado_revision<1 or p_escopo_revision is null or p_escopo_revision<1 or p_os_status is null or p_os_atualizada_em is null or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'chamadoRevision',p_chamado_revision,'escopoRevision',p_escopo_revision,'osStatus',p_os_status,'osAtualizadaEm',p_os_atualizada_em,'motivo',btrim(p_motivo));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('atribuicao-parcela:'||p_request_id::text,0));
  select * into v_a from pcm.sso_atribuicoes_parcela where request_id=p_request_id;
  if found then
    if v_a.ator_id is distinct from v_ator or config.sso_autorizar_acao('chamado.escopo.gerir',v_a.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_a.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'requestId',p_request_id,'execucaoComprovada',false);
  end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id;
  if not found then raise exception 'parcela_indisponivel' using errcode='23514'; end if;
  select * into v_chamado from pcm.chamados where id=v_parcela.chamado_id for update;
  if not found or v_chamado.deleted_at is not null or config.sso_autorizar_acao('chamado.escopo.gerir',v_chamado.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=v_chamado.id for update;
  if v_chamado.sso_revisao<>p_chamado_revision or v_escopo.chamado_id is null or v_escopo.revisao<>p_escopo_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=v_chamado.id for update;
  select * into v_os from pcm.ordens_servico where id=p_os_id and chamado_id=v_chamado.id and client_id=v_chamado.cliente_id and deleted_at is null for update;
  if v_parcela.id is null or v_parcela.situacao<>'pendente' or v_os.id is null or v_os.status is distinct from p_os_status or v_os.updated_at is distinct from p_os_atualizada_em
    or v_os.status in ('finalizado','cancelado') or not exists(select 1 from pcm.sso_backlog_parcelas b where b.parcela_id=p_parcela_id and b.chamado_id=v_chamado.id and b.cliente_id=v_chamado.cliente_id) then raise exception 'escopo_ou_os_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',v_chamado.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_atribuicoes_parcela(parcela_id,os_id,chamado_id,cliente_id,ator_id,request_id,payload) values(p_parcela_id,p_os_id,v_chamado.id,v_chamado.cliente_id,v_ator,p_request_id,v_payload);
  v_resultado:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'requestId',p_request_id,'execucaoComprovada',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'chamado.parcela_atribuida','chamados',v_chamado.id,v_resultado||jsonb_build_object('clienteId',v_chamado.cliente_id,'motivo',btrim(p_motivo)));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_atribuir_parcela_os(uuid,uuid,uuid,bigint,bigint,text,timestamptz,text) from public,anon,authenticated,service_role;

-- A declaração não vira prova de parada, mas não pode mencionar OS sem atribuição explícita.
create function pcm.sso_guardar_interrupcao_com_atribuicao() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from pcm.sso_atribuicoes_parcela a where a.parcela_id=new.parcela_id and a.os_id=new.os_id and a.chamado_id=new.chamado_id and a.cliente_id=new.cliente_id) then raise exception 'atribuicao_nao_comprovada' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_interrupcao_com_atribuicao() from public,anon,authenticated,service_role;
create trigger sso_interrupcao_exige_atribuicao before insert or update on pcm.sso_interrupcoes_parcela for each row execute function pcm.sso_guardar_interrupcao_com_atribuicao();
