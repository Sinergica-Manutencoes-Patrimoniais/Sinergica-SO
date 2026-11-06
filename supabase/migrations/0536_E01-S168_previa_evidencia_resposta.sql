-- ADR-0310: prévia de vínculos declarados, não prova de anexo autenticado.
create function pcm.sso_prever_evidencias_respostas(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(resposta_id uuid,chave_pergunta text,resultado text,evidencias_declaradas bigint,estado text,evidencia_autenticada boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_evidencia_resposta_gate where id),false) then raise exception 'evidencia_resposta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select r.id,r.chave_pergunta,r.resultado,count(v.id),case when count(v.id)=0 then 'sem_evidencia_declarada' else 'associacao_declarada_sem_autenticacao' end,false
 from pcm.respostas_os_preparadas r left join pcm.sso_evidencias_por_resposta v on v.retorno_id=r.retorno_id and v.resposta_id=r.id
 where r.retorno_id=p_retorno_id and (p_apos is null or r.id>p_apos) group by r.id,r.chave_pergunta,r.resultado order by r.id limit p_limite;
end; $$;
revoke all on function pcm.sso_prever_evidencias_respostas(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
