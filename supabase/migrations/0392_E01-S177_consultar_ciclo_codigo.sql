-- ADR-0166: consulta fechada; nenhum legado é convertido em rascunho.
create function pcm.sso_consultar_ciclo_codigo(p_tipo text,p_ativo_id uuid)
returns table(revisao integer,codigo text,aprovado_em timestamptz,sincronizado_em timestamptz,etiquetado_em timestamptz,referenciado_os_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_c pcm.sso_codigo_ciclo%rowtype; v_codigo text; v_cliente uuid;
begin
  if p_tipo is null or p_tipo not in ('sistema','componente') or p_ativo_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_c from pcm.sso_codigo_ciclo where tipo=p_tipo and ativo_id=p_ativo_id;
  if not found or config.sso_autorizar_acao('cadastro.gerir',v_c.cliente_id) is not true then raise exception 'ciclo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  if p_tipo='sistema' then select s.codigo,s.cliente_id into v_codigo,v_cliente from pcm.sistemas s where s.id=p_ativo_id and s.deleted_at is null;
  else select e.identificador,e.client_id into v_codigo,v_cliente from pcm.equipamentos e where e.id=p_ativo_id and e.deleted_at is null; end if;
  if v_cliente is distinct from v_c.cliente_id then raise exception 'ciclo_indisponivel_ou_sem_acesso' using errcode='42501'; end if;
  return query select v_c.revisao,v_codigo,v_c.aprovado_em,v_c.sincronizado_em,v_c.etiquetado_em,v_c.referenciado_os_em;
end;
$$;
revoke all on function pcm.sso_consultar_ciclo_codigo(text,uuid) from public,anon,authenticated,service_role;
