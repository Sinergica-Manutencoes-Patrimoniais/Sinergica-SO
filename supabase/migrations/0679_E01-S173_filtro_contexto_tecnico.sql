-- ADR-0453: consulta privada sem inferência normativa.
create table pcm.sso_filtro_contexto_tecnico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_filtro_contexto_tecnico_gate(id,habilitado) values(true,false);
alter table pcm.sso_filtro_contexto_tecnico_gate enable row level security;
alter table pcm.sso_filtro_contexto_tecnico_gate force row level security;
revoke all on pcm.sso_filtro_contexto_tecnico_gate from public,anon,authenticated,service_role;
create function pcm.sso_filtrar_contexto_pendencias(p_cliente_id uuid,p_norma_filtro text,p_condicao_filtro text,p_norma_valor text,p_apos uuid,p_limite integer)
returns table(pendencia_id uuid,alvo_tipo text,alvo_id uuid,pergunta text,revisao integer,norma text,condicao_informada boolean,contexto_registrado boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_filtro_contexto_tecnico_gate where id),false) then raise exception 'filtro_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 or p_norma_filtro is null or p_norma_filtro not in ('todas','informada','nao_informada') or p_condicao_filtro is null or p_condicao_filtro not in ('todas','informada','nao_informada') or (p_norma_valor is not null and (p_norma_filtro<>'informada' or length(btrim(p_norma_valor)) not between 1 and 500)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select p.id,p.alvo_tipo,p.alvo_id,p.pergunta,p.revisao,c.norma,c.condicao is not null,c.id is not null
 from pcm.sso_pendencias_tecnicas p left join lateral (select x.id,x.norma,x.condicao from pcm.sso_contexto_pendencia x where x.pendencia_id=p.id order by x.revisao desc limit 1) c on true
 where p.cliente_id=p_cliente_id and p.estado='aberta' and (p_apos is null or p.id>p_apos)
 and (p_norma_filtro='todas' or (p_norma_filtro='informada' and c.norma is not null) or (p_norma_filtro='nao_informada' and c.norma is null))
 and (p_condicao_filtro='todas' or (p_condicao_filtro='informada' and c.condicao is not null) or (p_condicao_filtro='nao_informada' and c.condicao is null))
 and (p_norma_valor is null or c.norma=btrim(p_norma_valor)) order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_filtrar_contexto_pendencias(uuid,text,text,text,uuid,integer) from public,anon,authenticated,service_role;
