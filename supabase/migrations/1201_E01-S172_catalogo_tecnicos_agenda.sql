-- ADR-1050: catálogo sob RLS, busca literal e cursor composto.
create function pcm.sso_catalogo_tecnicos_agenda(p_cliente_id uuid,p_busca text,p_apos_nome text,p_apos_id uuid,p_limite integer)
returns table(id uuid,nome text) language plpgsql volatile security invoker set search_path='' as $$
declare v_busca text:=coalesce(btrim(p_busca),'');
begin
  perform pcm.sso_exigir_filtro_tecnico_agenda();
  if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_limite is null or p_limite not between 1 and 100 or length(v_busca)>120 or ((p_apos_nome is null)<>(p_apos_id is null))
    or (p_apos_nome is not null and length(p_apos_nome)>500) then raise exception 'consulta_invalida' using errcode='22023'; end if;
  return query select f.id,f.nome from pcm.funcionarios f where f.ativo=true and f.deleted_at is null and f.nome is not null
    and (v_busca='' or pg_catalog.strpos(pg_catalog.lower(f.nome),pg_catalog.lower(v_busca))>0)
    and (p_apos_nome is null or (f.nome,f.id)>(p_apos_nome,p_apos_id)) order by f.nome,f.id limit p_limite;
end; $$;
revoke all on function pcm.sso_catalogo_tecnicos_agenda(uuid,text,text,uuid,integer) from public,anon,authenticated,service_role;
