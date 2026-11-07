-- ADR-0417: consulta diagnóstica privada; não cria vínculos.
create table pcm.sso_pendencias_sem_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_pendencias_sem_parcela_gate(id,habilitado) values(true,false);
alter table pcm.sso_pendencias_sem_parcela_gate enable row level security;alter table pcm.sso_pendencias_sem_parcela_gate force row level security;
revoke all on pcm.sso_pendencias_sem_parcela_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_pendencias_sem_parcela(p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(pendencia_id uuid,pergunta text,estado text,revisao_atual integer,revisao_origem integer,situacao text) language plpgsql stable security definer set search_path='' as $$
declare v_c pcm.sso_backlog_composicoes%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_pendencias_sem_parcela_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_composicao_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_c from pcm.sso_backlog_composicoes where id=p_composicao_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select p.id,p.pergunta,p.estado,p.revisao,b.revisao_origem,case when p.estado<>'aberta' then 'estado_nao_aberto' when p.revisao<>b.revisao_origem then 'revisao_alterada' else 'sem_parcela' end
    from pcm.sso_backlog_pendencias b join pcm.sso_pendencias_tecnicas p on p.id=b.pendencia_id and p.cliente_id=v_c.cliente_id
    where b.composicao_id=p_composicao_id and not exists(select 1 from pcm.sso_backlog_parcelas x where x.pendencia_id=p.id) and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_pendencias_sem_parcela(uuid,uuid,integer) from public,anon,authenticated,service_role;
