create table pcm.sso_diagnostico_colisoes_legadas_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_colisoes_legadas_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_colisoes_legadas_gate enable row level security;
alter table pcm.sso_diagnostico_colisoes_legadas_gate force row level security;
revoke all on pcm.sso_diagnostico_colisoes_legadas_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnosticar_colisoes_legadas(p_cliente_id uuid)
returns table(codigos_multiplos bigint,codigos_com_alias bigint,aliases_repetidos bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_colisoes_legadas_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000';end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 return query with codigos as (
  select upper(btrim(s.codigo)) codigo,'cadastro'::text origem from pcm.sistemas s where s.cliente_id=p_cliente_id and nullif(btrim(s.codigo),'') is not null
  union all select upper(btrim(e.identificador)),'cadastro' from pcm.equipamentos e where e.client_id=p_cliente_id and nullif(btrim(e.identificador),'') is not null
  union all select upper(btrim(a.codigo)),'alias' from pcm.sso_codigo_aliases a where a.cliente_id=p_cliente_id and nullif(btrim(a.codigo),'') is not null
 ), grupos as (select codigo,count(*) total,count(*) filter(where origem='cadastro') cadastros,count(*) filter(where origem='alias') aliases from codigos group by codigo)
 select count(*) filter(where total>1),count(*) filter(where cadastros>0 and aliases>0),count(*) filter(where aliases>1) from grupos;
end;$$;
revoke all on function pcm.sso_diagnosticar_colisoes_legadas(uuid) from public,anon,authenticated,service_role;
