-- ADR-1069: consulta de parcelas diretas para criação; não abre gates.
create function pcm.sso_listar_parcelas_para_os(p_ator_id uuid,p_cliente_id uuid,p_chamado_id uuid,p_apos uuid,p_limite integer)
returns table(parcela_id uuid,descricao text,chamado_revision bigint,escopo_revision bigint)
language plpgsql volatile security definer set search_path='' as $$
declare v_c pcm.chamados%rowtype;v_e pcm.chamado_escopo_composicoes%rowtype;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_chamado_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_criar_os_parcela_direta_gate where id and habilitado for share;
  if not found then raise exception 'criacao_os_parcela_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_c from pcm.chamados where id=p_chamado_id and cliente_id=p_cliente_id and deleted_at is null;
  if not found then raise exception 'chamado_indisponivel' using errcode='42501'; end if;
  select * into v_e from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id;
  if not found then raise exception 'escopo_indisponivel' using errcode='23514'; end if;
  return query select p.id,p.descricao,v_c.sso_revisao,v_e.revisao from pcm.chamado_escopo_parcelas p
    where p.chamado_id=p_chamado_id and p.situacao='pendente' and (p_apos is null or p.id>p_apos)
      and not exists(select 1 from pcm.sso_backlog_parcelas b where b.parcela_id=p.id)
      and not exists(select 1 from pcm.sso_ciclos_backlog b where b.parcela_id=p.id)
      and not exists(select 1 from pcm.sso_atribuicoes_parcela a where a.parcela_id=p.id)
    order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_parcelas_para_os(uuid,uuid,uuid,uuid,integer),pcm.sso_criar_os_parcela_direta(uuid,uuid,uuid,uuid,uuid,uuid,bigint,bigint,text,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_parcelas_para_os(uuid,uuid,uuid,uuid,integer),pcm.sso_criar_os_parcela_direta(uuid,uuid,uuid,uuid,uuid,uuid,bigint,bigint,text,text,jsonb,text) to authenticated;
