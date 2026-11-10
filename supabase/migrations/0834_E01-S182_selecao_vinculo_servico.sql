-- ADR-0609: seleção parcial e restrita, sem conteúdo de evidência.
create function financeiro.sso_opcoes_vinculo_resposta_servico(p_cliente_id uuid,p_declaracao_id uuid)
returns table(snapshot_id uuid,vinculo_evidencia_id uuid,resposta_id uuid,evidencia_id uuid,retorno_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from financeiro.sso_vinculo_resposta_servico_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not exists(select 1 from financeiro.sso_servicos_extra_declarados where id=p_declaracao_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select s.id,v.id,v.resposta_id,v.evidencia_id,v.retorno_id from financeiro.sso_servicos_extra_declarados d
 join financeiro.sso_snapshots_servico_extra s on s.declaracao_id=d.id and s.cliente_id=d.cliente_id
 join pcm.retorno_os_preparado r on r.cliente_id=d.cliente_id and r.os_id=d.os_id
 join pcm.sso_evidencias_por_resposta v on v.retorno_id=r.id
 where d.id=p_declaracao_id and d.cliente_id=p_cliente_id order by v.id limit 50;
end $$;
revoke all on function financeiro.sso_opcoes_vinculo_resposta_servico(uuid,uuid) from public,anon,authenticated,service_role;
