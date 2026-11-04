create function financeiro.sso_opcoes_fato_execucao_declarado(p_cliente_id uuid,p_declaracao_id uuid)
returns table(vinculo_id uuid,resposta_id uuid,retorno_id uuid,revisao_id uuid,revisao integer,decisao text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from financeiro.sso_fato_execucao_declarado_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not exists(select 1 from financeiro.sso_servicos_extra_declarados where id=p_declaracao_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select v.id,v.resposta_id,e.retorno_id,r.id,r.revisao,d.decisao from financeiro.sso_snapshots_servico_extra s
 join financeiro.sso_vinculos_resposta_servico v on v.snapshot_id=s.id and v.cliente_id=p_cliente_id
 join pcm.sso_evidencias_por_resposta e on e.id=v.vinculo_evidencia_id
 join pcm.retorno_os_preparado ro on ro.id=e.retorno_id and ro.cliente_id=p_cliente_id
 join pcm.sso_revisoes_validacao_os r on r.retorno_id=ro.id
 join pcm.decisoes_validacao_os d on d.id=r.decisao_id and d.retorno_id=ro.id
 where s.declaracao_id=p_declaracao_id and s.cliente_id=p_cliente_id and r.revisao=(select max(rr.revisao) from pcm.sso_revisoes_validacao_os rr where rr.retorno_id=ro.id)
 order by v.id limit 50;
end $$;
revoke all on function financeiro.sso_opcoes_fato_execucao_declarado(uuid,uuid) from public,anon,authenticated,service_role;
