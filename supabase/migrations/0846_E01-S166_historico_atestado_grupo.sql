-- ADR-0621: histórico de declarações, não autentica evidência.
create function pcm.sso_listar_atestados_grupo(p_cliente_id uuid,p_ocorrencia_id uuid,p_antes integer,p_limite integer)
returns table(request_id uuid,revisao integer,os_id uuid,declaracao text,referencia_evidencia text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_atestado_grupo_gate where id),false) then raise exception 'atestado_grupo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_ocorrencias_grupo where id=p_ocorrencia_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select a.request_id,a.revisao,a.os_id,a.declaracao,a.referencia_evidencia,a.ator_id,a.criado_em from pcm.sso_atestados_declarados_grupo a where a.cliente_id=p_cliente_id and a.ocorrencia_id=p_ocorrencia_id and (p_antes is null or a.revisao<p_antes) order by a.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_atestados_grupo(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
