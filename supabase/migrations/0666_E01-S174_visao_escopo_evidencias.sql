-- ADR-0440: visão informativa, sem devolução automática.
create table pcm.sso_visao_escopo_evidencias_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_visao_escopo_evidencias_gate(id,habilitado) values(true,false);
alter table pcm.sso_visao_escopo_evidencias_gate enable row level security;
alter table pcm.sso_visao_escopo_evidencias_gate force row level security;
revoke all on pcm.sso_visao_escopo_evidencias_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_escopo_evidencias(p_composicao_id uuid,p_apos uuid,p_limite integer)
returns table(pendencia_id uuid,parcela_id uuid,situacao_parcela text,reconciliacao_declarada text,reconciliacao_revisao integer,execucao_comprovada boolean,devolucao_autorizada boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_c pcm.sso_backlog_composicoes%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_visao_escopo_evidencias_gate where id),false) then raise exception 'visao_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_composicao_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_c from pcm.sso_backlog_composicoes where id=p_composicao_id;
 if not found or config.sso_autorizar_acao('execucao.validar',v_c.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_c.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select b.pendencia_id,a.parcela_id,p.situacao,r.estado,r.revisao,false,false
 from pcm.sso_backlog_pendencias b
 join pcm.sso_pendencias_tecnicas pt on pt.id=b.pendencia_id and pt.cliente_id=v_c.cliente_id
 left join pcm.sso_backlog_parcelas a on a.composicao_id=b.composicao_id and a.pendencia_id=b.pendencia_id and a.cliente_id=v_c.cliente_id
 left join pcm.chamado_escopo_parcelas p on p.id=a.parcela_id and p.chamado_id=a.chamado_id
 left join lateral (select x.estado,x.revisao from pcm.sso_reconciliacoes_parcela x where x.parcela_id=a.parcela_id and x.cliente_id=v_c.cliente_id order by x.revisao desc limit 1) r on true
 where b.composicao_id=p_composicao_id and (p_apos is null or b.pendencia_id>p_apos) order by b.pendencia_id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_escopo_evidencias(uuid,uuid,integer) from public,anon,authenticated,service_role;
