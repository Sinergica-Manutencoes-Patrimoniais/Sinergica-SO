-- ADR-0380: sinais administrativos somente; nenhuma devolução é autorizada.
create table pcm.sso_diagnostico_devolucao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_diagnostico_devolucao_gate(id,habilitado) values(true,false);
alter table pcm.sso_diagnostico_devolucao_gate enable row level security;alter table pcm.sso_diagnostico_devolucao_gate force row level security;
revoke all on pcm.sso_diagnostico_devolucao_gate from public,anon,authenticated,service_role;
create function pcm.sso_diagnostico_devolucao_parcial(p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(pendencia_id uuid,parcela_id uuid,situacao text,suspensao_declarada boolean,os_atribuida boolean,interrupcao_declarada boolean,prova_parada_disponivel boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_v pcm.sso_backlog_chamado_vinculos%rowtype;
begin
  if not coalesce((select habilitado from pcm.sso_diagnostico_devolucao_gate where id),false) then raise exception 'diagnostico_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_composicao_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_v from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_v.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_v.cliente_id) is not true or not exists(select 1 from pcm.chamados c where c.id=v_v.chamado_id and c.cliente_id=v_v.cliente_id and c.deleted_at is null) then raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select b.pendencia_id,b.parcela_id,p.situacao,
    exists(select 1 from pcm.sso_suspensoes_chamado s where s.chamado_id=b.chamado_id and s.cliente_id=b.cliente_id and s.estado='suspenso'),
    exists(select 1 from pcm.sso_atribuicoes_parcela a where a.parcela_id=b.parcela_id and a.chamado_id=b.chamado_id and a.cliente_id=b.cliente_id),
    exists(select 1 from pcm.sso_interrupcoes_parcela i join pcm.sso_atribuicoes_parcela a on a.parcela_id=i.parcela_id and a.os_id=i.os_id and a.chamado_id=i.chamado_id and a.cliente_id=i.cliente_id where i.parcela_id=b.parcela_id and i.chamado_id=b.chamado_id and i.cliente_id=b.cliente_id and i.estado='declarada'),false
    from pcm.sso_backlog_parcelas b join pcm.chamado_escopo_parcelas p on p.id=b.parcela_id and p.chamado_id=b.chamado_id where b.composicao_id=p_composicao_id and b.cliente_id=v_v.cliente_id and b.chamado_id=v_v.chamado_id and (p_apos is null or b.pendencia_id>p_apos) order by b.pendencia_id limit p_limite;
end;
$$;
revoke all on function pcm.sso_diagnostico_devolucao_parcial(uuid,uuid,integer) from public,anon,authenticated,service_role;
