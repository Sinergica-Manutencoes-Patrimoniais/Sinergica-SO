-- ADR-0293: busca declarada, leitura privada e gate fechado.
create table pcm.sso_busca_codigo_grupo_staging_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_busca_codigo_grupo_staging_gate(id,habilitado) values(true,false);
alter table pcm.sso_busca_codigo_grupo_staging_gate enable row level security;
alter table pcm.sso_busca_codigo_grupo_staging_gate force row level security;
revoke all on pcm.sso_busca_codigo_grupo_staging_gate from public,anon,authenticated,service_role;
create function pcm.sso_buscar_codigo_grupo_staging(p_cliente_id uuid,p_codigo text,p_apos_lote uuid,p_apos_chave text,p_limite integer)
returns table(lote_id uuid,linha_chave text,nome text,estado text)
language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.sso_busca_codigo_grupo_staging_gate where id),false) then raise exception 'busca_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_codigo is null or length(p_codigo) not between 1 and 200 or p_limite is null or p_limite not between 1 and 100 or ((p_apos_lote is null)<>(p_apos_chave is null)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select l.lote_id,l.chave,l.atributos->>'nome',case when i.entidade_id is not null then 'incorporada' when r.linha_chave is not null then 'rejeitada' else 'pendente' end
    from pcm.sso_levantamento_linhas l join pcm.sso_levantamentos b on b.id=l.lote_id and b.cliente_id=p_cliente_id
    left join pcm.sso_levantamento_incorporacoes i on i.lote_id=l.lote_id and i.linha_chave=l.chave
    left join pcm.sso_levantamento_rejeicoes r on r.lote_id=l.lote_id and r.linha_chave=l.chave
    where l.tipo='grupo_quantitativo' and l.atributos->>'codigoInformado'=p_codigo and (p_apos_lote is null or (l.lote_id,l.chave)>(p_apos_lote,p_apos_chave))
    order by l.lote_id,l.chave limit p_limite;
end;
$$;
revoke all on function pcm.sso_buscar_codigo_grupo_staging(uuid,text,uuid,text,integer) from public,anon,authenticated,service_role;
