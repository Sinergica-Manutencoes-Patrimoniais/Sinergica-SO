-- ADR-0415: lista parcial por vínculos comprovados, sem calcular impacto.
create function pcm.sso_listar_os_abertas_revisao(p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_apos uuid default null,p_limite integer default 20)
returns table(os_id uuid,ocorrencia_id uuid,rotina_id uuid,vencimento_original date,status text)
language plpgsql stable security definer set search_path='' as $$
declare v_revision integer;
begin
 if not coalesce((select habilitado from pcm.sso_impacto_revisao_os_gate where id),false) then raise exception 'impacto_revisao_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'limite_invalido' using errcode='22023'; end if;
 select revisao into v_revision from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 if p_expected_revision is null or v_revision<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 return query select os.id,o.id,o.rotina_id,o.vencimento_original,os.status::text from pcm.ocorrencias_rotina_preparadas o
 join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_preparada_id=o.id and v.ocorrencia_legada_id is not null
 join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id
 where o.plano_id=p_plano_id and os.client_id=p_cliente_id and os.deleted_at is null and os.status not in ('finalizado','cancelado') and (p_apos is null or os.id>p_apos)
 order by os.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_os_abertas_revisao(uuid,uuid,integer,uuid,integer) from public,anon,authenticated,service_role;
