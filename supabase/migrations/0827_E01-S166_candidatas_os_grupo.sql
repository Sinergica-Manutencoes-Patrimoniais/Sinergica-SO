-- ADR-0602: candidatas para declaração humana, não equivalência ou execução.
create function pcm.sso_listar_os_candidatas_grupo(p_cliente_id uuid,p_ocorrencia_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,numero text,titulo text,status text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_vinculo_os_grupo_gate where id),false) then raise exception 'vinculo_os_grupo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_ocorrencia_id is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 if not exists(select 1 from pcm.sso_ocorrencias_grupo o where o.id=p_ocorrencia_id and o.cliente_id=p_cliente_id) then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 return query select o.id,o.numero,o.titulo,o.status from pcm.ordens_servico o
 where o.client_id=p_cliente_id and o.deleted_at is null and o.ocorrencia_preventiva_id is null and o.chamado_id is null
 and (p_apos is null or o.id>p_apos) and not exists(select 1 from pcm.sso_vinculos_os_grupo v where v.os_id=o.id)
 order by o.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_os_candidatas_grupo(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
