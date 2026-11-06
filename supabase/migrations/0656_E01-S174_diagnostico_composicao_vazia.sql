-- ADR-0430: diagnóstico não é decisão de encerramento.
create table pcm.sso_diagnostico_composicao_vazia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_composicao_vazia_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_composicao_vazia_gate enable row level security;
alter table pcm.sso_diagnostico_composicao_vazia_gate force row level security;
revoke all on pcm.sso_diagnostico_composicao_vazia_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_composicoes_vazias_vinculadas(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(composicao_id uuid,chamado_id uuid,revisao integer,retiradas_registradas bigint,parcelas_vinculadas bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_composicao_vazia_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select c.id,v.chamado_id,c.revisao,
   (select count(*) from pcm.sso_retiradas_pendencia_composicao r where r.composicao_id=c.id and r.cliente_id=p_cliente_id),
   (select count(*) from pcm.sso_backlog_parcelas b where b.composicao_id=c.id and b.cliente_id=p_cliente_id)
 from pcm.sso_backlog_composicoes c join pcm.sso_backlog_chamado_vinculos v on v.composicao_id=c.id and v.cliente_id=c.cliente_id
 where c.cliente_id=p_cliente_id and (p_apos is null or c.id>p_apos) and not exists(select 1 from pcm.sso_backlog_pendencias b where b.composicao_id=c.id)
 order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_composicoes_vazias_vinculadas(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_historico_composicao_vazia_vinculada(p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,pendencia_id uuid,revisao_origem integer,revisao_composicao integer,motivo text,ator_id uuid,criado_em timestamptz,decisao_excepcional boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_diagnostico_composicao_vazia_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_composicao_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select c.cliente_id into v_cliente from pcm.sso_backlog_composicoes c join pcm.sso_backlog_chamado_vinculos v on v.composicao_id=c.id and v.cliente_id=c.cliente_id where c.id=p_composicao_id and not exists(select 1 from pcm.sso_backlog_pendencias b where b.composicao_id=c.id);
 if v_cliente is null or config.sso_autorizar_acao('execucao.validar',v_cliente) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_cliente) is not true then raise exception 'sem_acesso_ou_composicao_indisponivel' using errcode='42501'; end if;
 return query select r.id,r.pendencia_id,r.revisao_origem,r.revisao_composicao,r.motivo,r.ator_id,r.criado_em,exists(select 1 from pcm.sso_decisoes_ultima_pendencia d where d.request_id=r.request_id and d.composicao_id=r.composicao_id and d.cliente_id=r.cliente_id)
 from pcm.sso_retiradas_pendencia_composicao r where r.composicao_id=p_composicao_id and r.cliente_id=v_cliente and (p_apos is null or r.id>p_apos) order by r.id limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_composicao_vazia_vinculada(uuid,uuid,integer) from public,anon,authenticated,service_role;
