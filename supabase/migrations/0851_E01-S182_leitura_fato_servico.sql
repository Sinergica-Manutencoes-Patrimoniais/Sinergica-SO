create function financeiro.sso_consultar_fato_execucao_declarado(p_cliente_id uuid,p_declaracao_id uuid)
returns table(fato_id uuid) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from financeiro.sso_fato_execucao_declarado_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not exists(select 1 from financeiro.sso_servicos_extra_declarados where id=p_declaracao_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select f.id from financeiro.sso_snapshots_servico_extra s join financeiro.sso_vinculos_resposta_servico v on v.snapshot_id=s.id and v.cliente_id=p_cliente_id
 join financeiro.sso_fatos_execucao_declarados f on f.vinculo_id=v.id and f.cliente_id=p_cliente_id where s.declaracao_id=p_declaracao_id and s.cliente_id=p_cliente_id;
end $$;
revoke all on function financeiro.sso_consultar_fato_execucao_declarado(uuid,uuid) from public,anon,authenticated,service_role;
