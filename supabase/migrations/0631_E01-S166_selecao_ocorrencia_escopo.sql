-- ADR-0405: lista autorizada e paginada; não altera escopo nem ocorrência.
create function pcm.sso_listar_ocorrencias_escopo(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_apos uuid default null,p_limite integer default 20)
returns table(id uuid,vencimento_original date,alvo_tipo text,alvo_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_escopo_preventivo_gate where id),false) then raise exception 'escopo_preventivo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'limite_invalido' using errcode='22023'; end if;
 if not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select o.id,o.vencimento_original,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_rotina_preparadas o
 join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id and v.ocorrencia_legada_id is not null
 where o.plano_id=p_plano_id and o.versao_id=p_versao_id and o.rotina_id=p_rotina_id and (p_apos is null or o.id>p_apos)
 order by o.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_ocorrencias_escopo(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
