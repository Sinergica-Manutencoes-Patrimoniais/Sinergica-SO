-- ADR-0447: relatório privado, sem inferir condição.
create table pcm.sso_condicao_nao_informada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_condicao_nao_informada_gate(id,habilitado) values(true,false);
alter table pcm.sso_condicao_nao_informada_gate enable row level security;
alter table pcm.sso_condicao_nao_informada_gate force row level security;
revoke all on pcm.sso_condicao_nao_informada_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_pendencias_sem_condicao(p_cliente_id uuid,p_alvo_tipo text,p_alvo_id uuid,p_apos uuid,p_limite integer)
returns table(pendencia_id uuid,alvo_tipo text,alvo_id uuid,pergunta text,revisao integer,situacao_contexto text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_condicao_nao_informada_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 or ((p_alvo_tipo is null) <> (p_alvo_id is null)) or (p_alvo_tipo is not null and p_alvo_tipo not in ('sistema','componente','grupo')) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select p.id,p.alvo_tipo,p.alvo_id,p.pergunta,p.revisao,case when c.id is null then 'sem_contexto_registrado' else 'condicao_nao_informada' end
 from pcm.sso_pendencias_tecnicas p left join lateral (select x.id,x.condicao from pcm.sso_contexto_pendencia x where x.pendencia_id=p.id order by x.revisao desc limit 1) c on true
 where p.cliente_id=p_cliente_id and p.estado='aberta' and (p_alvo_tipo is null or (p.alvo_tipo=p_alvo_tipo and p.alvo_id=p_alvo_id)) and (p_apos is null or p.id>p_apos) and c.condicao is null
 order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_pendencias_sem_condicao(uuid,text,uuid,uuid,integer) from public,anon,authenticated,service_role;
