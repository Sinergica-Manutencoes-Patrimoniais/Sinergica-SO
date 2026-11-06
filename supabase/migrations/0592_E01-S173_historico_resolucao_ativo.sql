-- ADR-0366: leitura privada de decisões explícitas, sem arquivos.
create table pcm.sso_historico_resolucao_ativo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_resolucao_ativo_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_resolucao_ativo_gate enable row level security;alter table pcm.sso_historico_resolucao_ativo_gate force row level security;
revoke all on pcm.sso_historico_resolucao_ativo_gate from public,anon,authenticated,service_role;
create function pcm.sso_historico_resolucao_ativo(p_cliente_id uuid,p_alvo_tipo text,p_alvo_id uuid,p_antes timestamptz,p_antes_id uuid,p_limite integer)
returns table(id uuid,pendencia_id uuid,revisao integer,decisao text,motivo text,ator_id uuid,ocorrido_em timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce((select habilitado from pcm.sso_historico_resolucao_ativo_gate where id),false) then raise exception 'historico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_alvo_tipo is null or p_alvo_tipo not in ('sistema','componente','grupo') or p_alvo_id is null or p_limite is null or p_limite not between 1 and 100 or ((p_antes is null)<>(p_antes_id is null)) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select d.id,d.pendencia_id,d.revisao,d.decisao,d.motivo,d.ator_id,d.ocorrido_em from pcm.sso_pendencias_decisoes d join pcm.sso_pendencias_tecnicas p on p.id=d.pendencia_id where p.cliente_id=p_cliente_id and p.alvo_tipo=p_alvo_tipo and p.alvo_id=p_alvo_id and d.decisao in ('resolvida','reaberta') and (p_antes is null or (d.ocorrido_em,d.id)<(p_antes,p_antes_id)) order by d.ocorrido_em desc,d.id desc limit p_limite;
end;
$$;
revoke all on function pcm.sso_historico_resolucao_ativo(uuid,text,uuid,timestamptz,uuid,integer) from public,anon,authenticated,service_role;
