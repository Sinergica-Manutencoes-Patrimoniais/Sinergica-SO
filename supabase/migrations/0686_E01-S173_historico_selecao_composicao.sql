-- ADR-0460: consulta de comando já auditado, sem criar histórico paralelo.
create table pcm.sso_historico_selecao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_selecao_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_selecao_gate enable row level security;
alter table pcm.sso_historico_selecao_gate force row level security;
revoke all on pcm.sso_historico_selecao_gate from public,anon,authenticated,service_role;
create function pcm.sso_historico_selecao_composicao(p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,ator_id uuid,itens jsonb)
language plpgsql stable security definer set search_path='' as $$
declare v_c pcm.sso_backlog_composicoes%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_historico_selecao_gate where id),false) then raise exception 'historico_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_composicao_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_c from pcm.sso_backlog_composicoes where id=p_composicao_id;
 if not found or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select cmd.request_id,cmd.ator_id,cmd.payload->'itens' from pcm.sso_backlog_comandos cmd
 where cmd.cliente_id=v_c.cliente_id and cmd.resultado->>'aggregateId'=p_composicao_id::text and jsonb_typeof(cmd.payload->'itens')='array' and (p_apos is null or cmd.request_id>p_apos)
 order by cmd.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_selecao_composicao(uuid,uuid,integer) from public,anon,authenticated,service_role;
