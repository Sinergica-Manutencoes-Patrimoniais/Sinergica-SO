-- ADR-0966: wrapper fechado, núcleo privado; rollout exige cliente coordenado.
create table pcm.sso_leitura_os_chamado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_leitura_os_chamado_gate(id,habilitado) values(true,false);
alter table pcm.sso_leitura_os_chamado_gate enable row level security;
alter table pcm.sso_leitura_os_chamado_gate force row level security;
revoke all on pcm.sso_leitura_os_chamado_gate from public,anon,authenticated,service_role;

create function pcm.sso_listar_ordens_chamado_segura(p_cliente_id uuid,p_chamado_id uuid,p_limite integer default 50,p_apos uuid default null)
returns table(id uuid,numero text,titulo text,status text)
language plpgsql volatile security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_leitura_os_chamado_gate g where g.id and g.habilitado for share;
  if not found then raise exception 'leitura_os_chamado_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_chamado_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('chamado.encerrar',p_cliente_id) is distinct from true
    or not exists(select 1 from pcm.chamados c where c.id=p_chamado_id and c.cliente_id=p_cliente_id and c.deleted_at is null) then
    raise exception 'chamado_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
  return query select o.id,o.numero,o.titulo,o.status from pcm.sso_listar_ordens_chamado(p_cliente_id,p_chamado_id,p_limite,p_apos) o;
end; $$;
revoke all on function pcm.sso_listar_ordens_chamado_segura(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_listar_ordens_chamado(uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;
