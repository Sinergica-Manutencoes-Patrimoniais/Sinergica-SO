-- ADR-1248: consulta aditiva, gate desligado, sem substituir a busca legada.
create table pcm.sso_busca_unificada_grupo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_busca_unificada_grupo_gate(id, habilitado) values(true, false);
alter table pcm.sso_busca_unificada_grupo_gate enable row level security;
alter table pcm.sso_busca_unificada_grupo_gate force row level security;
revoke all on pcm.sso_busca_unificada_grupo_gate from public, anon, authenticated, service_role;

create function pcm.sso_localizar_codigo_com_grupo(p_cliente_id uuid, p_codigo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_codigo text; v_total bigint; v_tipo text; v_id uuid; v_atual text;
begin
  if auth.uid() is null or p_cliente_id is null or p_codigo is null or length(btrim(p_codigo)) not between 1 and 200 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  perform 1 from pcm.sso_busca_unificada_grupo_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('cadastro.ler', p_cliente_id) is not true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-codigos-publicos', 0)) then
    raise exception 'codigo_em_alteracao' using errcode = '55P03';
  end if;
  v_codigo := upper(btrim(p_codigo));
  with encontrados as (
    select 'sistema'::text tipo, s.id from pcm.sistemas s where s.cliente_id = p_cliente_id and s.deleted_at is null and upper(btrim(s.codigo)) = v_codigo
    union select 'componente', e.id from pcm.equipamentos e where e.client_id = p_cliente_id and e.deleted_at is null and upper(btrim(e.identificador)) = v_codigo
    union select 'sistema', s.id from pcm.sso_codigo_aliases a join pcm.sistemas s on s.id = a.sistema_id and s.cliente_id = a.cliente_id where a.cliente_id = p_cliente_id and s.deleted_at is null and upper(btrim(a.codigo)) = v_codigo
    union select 'componente', e.id from pcm.sso_codigo_aliases a join pcm.equipamentos e on e.id = a.componente_id and e.client_id = a.cliente_id where a.cliente_id = p_cliente_id and e.deleted_at is null and upper(btrim(a.codigo)) = v_codigo
    union select 'grupo_quantitativo', g.id from pcm.sso_codigos_grupo_quantitativo c join pcm.grupos_quantitativos g on g.id = c.grupo_id and g.cliente_id = c.cliente_id where c.cliente_id = p_cliente_id and g.deleted_at is null and upper(btrim(c.codigo)) = v_codigo
  ) select count(*), min(tipo), min(id::text)::uuid into v_total, v_tipo, v_id from encontrados;
  if v_total = 0 then return jsonb_build_object('situacao', 'nao_encontrado'); end if;
  if v_total > 1 then return jsonb_build_object('situacao', 'ambiguo'); end if;
  if v_tipo = 'grupo_quantitativo' then
    select codigo into v_atual from pcm.sso_codigos_grupo_quantitativo where grupo_id = v_id and cliente_id = p_cliente_id and atual;
    if not found then raise exception 'codigo_atual_indisponivel' using errcode = '23514'; end if;
    return jsonb_build_object('situacao', 'encontrado', 'tipo', v_tipo, 'ativoId', v_id, 'codigoAtual', v_atual, 'codigoHistorico', upper(btrim(v_atual)) <> v_codigo);
  end if;
  return jsonb_build_object('situacao', 'encontrado', 'tipo', v_tipo, 'ativoId', v_id);
end $$;
revoke all on function pcm.sso_localizar_codigo_com_grupo(uuid, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_localizar_codigo_com_grupo(uuid, text) to authenticated;
