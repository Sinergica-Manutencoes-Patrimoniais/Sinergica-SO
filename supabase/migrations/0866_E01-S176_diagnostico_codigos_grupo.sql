create table pcm.sso_diagnostico_codigos_grupo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_codigos_grupo_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_codigos_grupo_gate enable row level security;alter table pcm.sso_diagnostico_codigos_grupo_gate force row level security;
revoke all on pcm.sso_diagnostico_codigos_grupo_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnosticar_codigos_grupo(p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,informado boolean,sistemas_cliente bigint,componentes_cliente bigint,aliases_cliente bigint,outras_linhas_grupo bigint)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_codigos_grupo_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos)>200) then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 return query with grupos as (select l.chave,nullif(btrim(l.atributos->>'codigoInformado'),'') codigo from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.tipo='grupo_quantitativo')
 select g.chave,g.codigo is not null,
  (select count(*) from pcm.sistemas s where s.cliente_id=v_cliente and g.codigo is not null and upper(btrim(s.codigo))=upper(g.codigo)),
  (select count(*) from pcm.equipamentos e where e.client_id=v_cliente and g.codigo is not null and upper(btrim(e.identificador))=upper(g.codigo)),
  (select count(*) from pcm.sso_codigo_aliases a where a.cliente_id=v_cliente and g.codigo is not null and upper(btrim(a.codigo))=upper(g.codigo)),
  (select count(*) from grupos x where x.chave<>g.chave and g.codigo is not null and upper(x.codigo)=upper(g.codigo))
 from grupos g where p_apos is null or g.chave>p_apos order by g.chave limit p_limite;
end;$$;
revoke all on function pcm.sso_diagnosticar_codigos_grupo(uuid,text,integer) from public,anon,authenticated,service_role;
