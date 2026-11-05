-- ADR-0443: rastreabilidade informativa, sem mutação.
create table pcm.sso_rastreabilidade_pendencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_rastreabilidade_pendencia_gate(id,habilitado) values(true,false);
alter table pcm.sso_rastreabilidade_pendencia_gate enable row level security;
alter table pcm.sso_rastreabilidade_pendencia_gate force row level security;
revoke all on pcm.sso_rastreabilidade_pendencia_gate from public,anon,authenticated,service_role;
create function pcm.sso_origem_pendencia(p_pendencia_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_rastreabilidade_pendencia_gate where id),false) then raise exception 'rastreabilidade_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_pendencia_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
 if not found or config.sso_autorizar_acao('execucao.validar',v_p.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_p.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('pendenciaId',v_p.id,'respostaId',v_p.resposta_id,'retornoId',v_p.retorno_id,'osOrigemId',v_p.os_id,'ocorrenciaId',v_p.ocorrencia_id,'rotinaId',v_p.rotina_id,'alvoTipo',v_p.alvo_tipo,'alvoId',v_p.alvo_id);
end; $$;
revoke all on function pcm.sso_origem_pendencia(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_vinculos_pendencia(p_pendencia_id uuid,p_apos uuid,p_limite integer)
returns table(composicao_id uuid,chamado_id uuid,parcela_id uuid,os_atribuida_id uuid)
language plpgsql stable security definer set search_path='' as $$
declare v_p pcm.sso_pendencias_tecnicas%rowtype; v_origem jsonb;
begin
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_origem:=pcm.sso_origem_pendencia(p_pendencia_id);
 select * into v_p from pcm.sso_pendencias_tecnicas where id=p_pendencia_id;
 return query select c.id,v.chamado_id,bp.parcela_id,a.os_id
 from pcm.sso_backlog_pendencias b join pcm.sso_backlog_composicoes c on c.id=b.composicao_id and c.cliente_id=v_p.cliente_id
 left join pcm.sso_backlog_chamado_vinculos v on v.composicao_id=c.id and v.cliente_id=v_p.cliente_id
 left join pcm.sso_backlog_parcelas bp on bp.composicao_id=c.id and bp.pendencia_id=b.pendencia_id and bp.cliente_id=v_p.cliente_id and bp.chamado_id=v.chamado_id
 left join pcm.sso_atribuicoes_parcela a on a.parcela_id=bp.parcela_id and a.chamado_id=bp.chamado_id and a.cliente_id=v_p.cliente_id
 where b.pendencia_id=p_pendencia_id and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_vinculos_pendencia(uuid,uuid,integer) from public,anon,authenticated,service_role;
