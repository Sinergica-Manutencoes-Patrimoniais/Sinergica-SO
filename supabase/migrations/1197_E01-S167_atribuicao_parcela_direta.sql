-- ADR-1046: somente parcelas diretas, sem vínculo ou ciclo de Backlog.
create table pcm.sso_atribuicao_direta_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_atribuicao_direta_gate(id,habilitado) values(true,false);
alter table pcm.sso_atribuicao_direta_gate enable row level security;
alter table pcm.sso_atribuicao_direta_gate force row level security;
revoke all on pcm.sso_atribuicao_direta_gate from public,anon,authenticated,service_role;
create table pcm.sso_atribuicoes_diretas(request_id uuid primary key references pcm.sso_atribuicoes_parcela(request_id),parcela_id uuid not null unique references pcm.chamado_escopo_parcelas(id));
alter table pcm.sso_atribuicoes_diretas enable row level security;
alter table pcm.sso_atribuicoes_diretas force row level security;
revoke all on pcm.sso_atribuicoes_diretas from public,anon,authenticated,service_role;
create trigger sso_atribuicoes_diretas_imutaveis before update or delete on pcm.sso_atribuicoes_diretas for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_os_para_parcela_direta(p_ator_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_parcela_id uuid,p_apos uuid,p_limite integer)
returns table(os_id uuid,numero text,estado_os text,os_atualizada_em timestamptz,chamado_revision bigint,escopo_revision bigint)
language plpgsql volatile security definer set search_path='' as $$
declare v_chamado pcm.chamados%rowtype;v_escopo pcm.chamado_escopo_composicoes%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_chamado_id is null or p_parcela_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_atribuicao_direta_gate where id and habilitado for share;if not found then raise exception 'atribuicao_direta_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_atribuicao_parcela_gate where id and habilitado for share;if not found then raise exception 'atribuicao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select c.* into v_chamado from pcm.chamados c join pcm.chamado_escopo_parcelas p on p.chamado_id=c.id
    where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null and p.id=p_parcela_id and p.situacao='pendente';
  if not found then raise exception 'parcela_indisponivel' using errcode='42501'; end if;
  if exists(select 1 from pcm.sso_backlog_parcelas where parcela_id=p_parcela_id) or exists(select 1 from pcm.sso_ciclos_backlog where parcela_id=p_parcela_id) then raise exception 'origem_backlog_requer_caminho_proprio' using errcode='23514'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id;
  if not found then raise exception 'escopo_indisponivel' using errcode='23514'; end if;
  if exists(select 1 from pcm.sso_atribuicoes_parcela where parcela_id=p_parcela_id) then return; end if;
  return query select o.id,o.numero,o.status,o.updated_at,v_chamado.sso_revisao,v_escopo.revisao from pcm.ordens_servico o
    where o.chamado_id=p_chamado_id and o.client_id=p_cliente_id and o.deleted_at is null and o.status not in ('finalizado','cancelado')
      and o.updated_at is not null and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end; $$;
revoke all on function pcm.sso_os_para_parcela_direta(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_atribuir_parcela_direta(p_request_id uuid,p_ator_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_parcela_id uuid,p_os_id uuid,
  p_chamado_revision bigint,p_escopo_revision bigint,p_os_status text,p_os_atualizada_em timestamptz,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_chamado pcm.chamados%rowtype;v_escopo pcm.chamado_escopo_composicoes%rowtype;v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_os pcm.ordens_servico%rowtype;v_ant pcm.sso_atribuicoes_parcela%rowtype;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_chamado_id is null or p_parcela_id is null or p_os_id is null or p_request_id is null
    or p_chamado_revision is null or p_chamado_revision<1 or p_escopo_revision is null or p_escopo_revision<1 or p_os_status is null or p_os_atualizada_em is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_atribuicao_direta_gate where id and habilitado for share;if not found then raise exception 'atribuicao_direta_desabilitada' using errcode='55000'; end if;
  perform 1 from pcm.sso_atribuicao_parcela_gate where id and habilitado for share;if not found then raise exception 'atribuicao_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_payload:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'chamadoRevision',p_chamado_revision,'escopoRevision',p_escopo_revision,'osStatus',p_os_status,'osAtualizadaEm',p_os_atualizada_em,'motivo',v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('atribuicao-parcela:'||p_request_id::text,0));
  select * into v_ant from pcm.sso_atribuicoes_parcela where request_id=p_request_id;
  if found then
    if v_ant.ator_id is distinct from p_ator_id or v_ant.cliente_id is distinct from p_cliente_id then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_ant.chamado_id is distinct from p_chamado_id or v_ant.payload is distinct from v_payload
      or not exists(select 1 from pcm.sso_atribuicoes_diretas where request_id=p_request_id and parcela_id=p_parcela_id) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'requestId',p_request_id,'execucaoComprovada',false);
  end if;
  select * into v_chamado from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null for update;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_escopo from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id for update;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id=p_parcela_id and chamado_id=p_chamado_id for update;
  select * into v_os from pcm.ordens_servico where id=p_os_id and chamado_id=p_chamado_id and client_id=p_cliente_id and deleted_at is null for update;
  if v_escopo.chamado_id is null or v_chamado.sso_revisao is distinct from p_chamado_revision or v_escopo.revisao is distinct from p_escopo_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if v_parcela.id is null or v_parcela.situacao<>'pendente' or v_os.id is null or v_os.status is distinct from p_os_status or v_os.updated_at is distinct from p_os_atualizada_em or v_os.status in ('finalizado','cancelado')
    or exists(select 1 from pcm.sso_backlog_parcelas where parcela_id=p_parcela_id) or exists(select 1 from pcm.sso_ciclos_backlog where parcela_id=p_parcela_id)
    or exists(select 1 from pcm.sso_atribuicoes_parcela where parcela_id=p_parcela_id) then raise exception 'escopo_ou_os_indisponivel' using errcode='23514'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.sso_atribuicoes_parcela(parcela_id,os_id,chamado_id,cliente_id,ator_id,request_id,payload) values(p_parcela_id,p_os_id,p_chamado_id,p_cliente_id,p_ator_id,p_request_id,v_payload);
  insert into pcm.sso_atribuicoes_diretas(request_id,parcela_id) values(p_request_id,p_parcela_id);
  v_resultado:=jsonb_build_object('parcelaId',p_parcela_id,'osId',p_os_id,'requestId',p_request_id,'execucaoComprovada',false);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'chamado.parcela_atribuida','chamados',p_chamado_id,v_resultado||jsonb_build_object('clienteId',p_cliente_id,'origem','direta','motivo',v_motivo));
  return v_resultado;
end; $$;
revoke all on function pcm.sso_atribuir_parcela_direta(uuid,uuid,uuid,uuid,uuid,uuid,bigint,bigint,text,timestamptz,text) from public,anon,authenticated,service_role;
