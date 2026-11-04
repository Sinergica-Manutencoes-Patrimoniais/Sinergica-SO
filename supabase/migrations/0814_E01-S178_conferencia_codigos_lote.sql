-- Diagnóstico, não decisão de unicidade nem autorização para gravar.
create table pcm.sso_conferencia_codigos_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_conferencia_codigos_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_conferencia_codigos_lote_gate enable row level security;
alter table pcm.sso_conferencia_codigos_lote_gate force row level security;
revoke all on pcm.sso_conferencia_codigos_lote_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferir_codigos_lote(p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo text,codigo_informado text,codigo_candidato text,formato_invalido boolean,codigos_divergentes boolean,outras_linhas bigint,cadastros_cliente bigint,aliases_cliente bigint)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_conferencia_codigos_lote_gate where id),false) then raise exception 'conferencia_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos)>200) then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 return query with base as (
  select l.chave,l.tipo,nullif(btrim(l.atributos->>'codigoInformado'),'') informado,nullif(btrim(s.codigo),'') candidato
  from pcm.sso_levantamento_linhas l left join pcm.sso_codigo_staging s on s.lote_id=l.lote_id and s.linha_chave=l.chave where l.lote_id=p_lote_id
 ), dados as (select b.*,coalesce(b.candidato,b.informado) codigo from base b)
 select d.chave,d.tipo,d.informado,d.candidato,
  coalesce(d.codigo is not null and (length(d.codigo)>200 or d.codigo<>upper(d.codigo) or d.codigo~'[[:space:]]'),false),
  coalesce(d.informado is not null and d.candidato is not null and d.informado<>d.candidato,false),
  (select count(*) from dados b where b.chave<>d.chave and d.codigo is not null and upper(btrim(b.codigo))=upper(btrim(d.codigo))),
  (select count(*) from (select s.id from pcm.sistemas s where s.cliente_id=v_cliente and d.codigo is not null and upper(btrim(s.codigo))=upper(btrim(d.codigo)) union all select e.id from pcm.equipamentos e where e.client_id=v_cliente and d.codigo is not null and upper(btrim(e.identificador))=upper(btrim(d.codigo))) a),
  (select count(*) from pcm.sso_codigo_aliases a where a.cliente_id=v_cliente and d.codigo is not null and upper(btrim(a.codigo))=upper(btrim(d.codigo)))
 from dados d where (p_apos is null or d.chave>p_apos) order by d.chave limit p_limite;
end;$$;
revoke all on function pcm.sso_conferir_codigos_lote(uuid,text,integer) from public,anon,authenticated,service_role;
