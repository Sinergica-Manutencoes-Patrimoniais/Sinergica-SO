-- ADR-1189: busca opcional no cadastro existente, sem criar Pendências.
create table pcm.sso_busca_ativos_resultados_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_busca_ativos_resultados_gate(id,habilitado) values(true,false);
alter table pcm.sso_busca_ativos_resultados_gate enable row level security;
alter table pcm.sso_busca_ativos_resultados_gate force row level security;
revoke all on pcm.sso_busca_ativos_resultados_gate from public,anon,authenticated,service_role;

create function pcm.sso_buscar_ativos_resultados(p_ator_id uuid,p_cliente_id uuid,p_tipo text,p_busca text,p_apos uuid,p_limite integer)
returns table(id uuid,nome text,ativo boolean) language plpgsql volatile security definer set search_path='' as $$
declare v_busca text:=pg_catalog.lower(pg_catalog.btrim(p_busca));
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_tipo is null
    or p_tipo not in ('sistema','componente','grupo') or p_busca is null or pg_catalog.length(v_busca) not between 2 and 120
    or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_resultados_ativo_gate where id and habilitado for share;
  if not found then raise exception 'resultados_desabilitados' using errcode='55000'; end if;
  perform 1 from pcm.sso_busca_ativos_resultados_gate where id and habilitado for share;
  if not found then raise exception 'busca_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.ler',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_tipo='sistema' then
    return query select s.id,s.nome,s.ativo from pcm.sistemas s where s.cliente_id=p_cliente_id and s.deleted_at is null and (p_apos is null or s.id>p_apos) and position(v_busca in pg_catalog.lower(s.nome))>0 order by s.id limit p_limite;
  elsif p_tipo='componente' then
    return query select e.id,e.nome,e.ativo from pcm.equipamentos e where e.client_id=p_cliente_id and e.deleted_at is null and (p_apos is null or e.id>p_apos) and position(v_busca in pg_catalog.lower(e.nome))>0 order by e.id limit p_limite;
  else
    return query select g.id,g.nome,g.ativo from pcm.grupos_quantitativos g where g.cliente_id=p_cliente_id and g.deleted_at is null and (p_apos is null or g.id>p_apos) and position(v_busca in pg_catalog.lower(g.nome))>0 order by g.id limit p_limite;
  end if;
end; $$;
revoke all on function pcm.sso_buscar_ativos_resultados(uuid,uuid,text,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_buscar_ativos_resultados(uuid,uuid,text,text,uuid,integer) to authenticated;
