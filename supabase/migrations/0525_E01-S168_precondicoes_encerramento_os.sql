-- ADR-0299: diagnóstico somente; não encerra OS nem Chamado.
create table pcm.sso_encerramento_os_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_encerramento_os_gate enable row level security;
alter table pcm.sso_encerramento_os_gate force row level security;
revoke all on pcm.sso_encerramento_os_gate from public,anon,authenticated,service_role;
insert into pcm.sso_encerramento_os_gate(id,habilitado) values(true,false);

create function pcm.sso_diagnosticar_encerramento_os(p_cliente_id uuid,p_os_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_retorno pcm.retorno_os_preparado%rowtype;v_aprovacoes bigint;v_devolucoes bigint;v_reaberturas bigint;
begin
 if not coalesce((select habilitado from pcm.sso_encerramento_os_gate where id),false) or not coalesce((select habilitado from pcm.validacao_os_gate where id),false) then raise exception 'encerramento_os_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_retorno from pcm.retorno_os_preparado r where r.id=p_retorno_id and r.os_id=p_os_id and r.cliente_id=p_cliente_id and exists(select 1 from pcm.ordens_servico o where o.id=r.os_id and o.client_id=p_cliente_id and o.deleted_at is null);
 if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
 select count(*) filter(where decisao='aprovar'),count(*) filter(where decisao='devolver'),count(*) filter(where decisao='reabrir') into v_aprovacoes,v_devolucoes,v_reaberturas from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 return jsonb_build_object('retornoId',p_retorno_id,'osId',p_os_id,'origem',v_retorno.origem,'coberturaMarcada',v_retorno.cobertura_comprovada,'aprovacoes',v_aprovacoes,'devolucoes',v_devolucoes,'reaberturas',v_reaberturas,'encerramentoDisponivel',false,
  'impedimentos',jsonb_build_array('integralidade_e_evidencia_nao_comprovadas','decisao_atual_sem_ordenacao_versionada','transicao_os_e_efeitos_nao_homologados'));
end; $$;
revoke all on function pcm.sso_diagnosticar_encerramento_os(uuid,uuid,uuid) from public,anon,authenticated,service_role;
