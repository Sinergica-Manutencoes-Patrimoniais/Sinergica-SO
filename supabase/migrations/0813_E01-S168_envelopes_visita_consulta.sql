-- ADR-0588: consulta de candidatos por Visita, sem criar ou validar retorno.
create function pcm.sso_listar_envelopes_visita_candidatos(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(envelope_id uuid,resolucao_id uuid,os_id uuid,ocorrido_em timestamptz,recebido_em timestamptz,origem jsonb)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false)
   or not coalesce((select habilitado from pcm.validacao_os_gate where id),false)
   or not coalesce((select habilitado from pcm.sso_origem_execucao_unificada_gate where id),false) then raise exception 'consulta_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select i.id,r.id,os.id,i.ocorrido_em,i.recebido_em,pcm.sso_previa_origem_visita_os(p_cliente_id,os.id)
 from pcm.origem_campo_inbox i
 join lateral (select rr.* from pcm.origem_campo_resolucoes rr where rr.envelope_id=i.id order by rr.criada_em desc,rr.id desc limit 1) r on r.resultado='os_identificada' and r.cliente_id=p_cliente_id
 join pcm.clientes c on c.id=p_cliente_id and c.deleted_at is null and c.auvo_id::text=i.cliente_externo_id
 join pcm.ordens_servico os on os.id=r.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.auvo_task_id=i.task_id
 join pcm.sso_vinculos_visita_legado vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id and vinc.cliente_id=p_cliente_id
 where i.integracao='auvo' and (p_apos is null or i.id>p_apos)
 and not exists(select 1 from pcm.retorno_campo_classificacoes cl where cl.envelope_id=i.id)
 order by i.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_envelopes_visita_candidatos(uuid,uuid,integer) from public,anon,authenticated,service_role;
