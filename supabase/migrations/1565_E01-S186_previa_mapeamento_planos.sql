-- ADR-1421: mapeamento observável, não aceite ou migração.
create function pcm.sso_autorizar_exportacao_preflight(p_ator_id uuid,p_cliente_id uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
begin perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);return true;end; $$;
revoke all on function pcm.sso_autorizar_exportacao_preflight(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_autorizar_exportacao_preflight(uuid,uuid) to authenticated;

create function pcm.sso_prever_mapeamento_planos(p_ator_id uuid,p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(plano_legado_id uuid,plano_destino_id uuid,rotina_id uuid,versao_id uuid,estado_destino text,classificacao text)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_preflight_mediado(p_ator_id,p_cliente_id);
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select p.id,novo.id,case when m.cliente_id=p_cliente_id then m.rotina_id else null end,case when m.cliente_id=p_cliente_id then m.versao_id else null end,novo.estado::text,
   case when num_nonnulls(p.sistema_id,p.equipamento_id)<>1 then 'alvo_ambiguo'
     when (p.sistema_id is not null and not exists(select 1 from pcm.sistemas s where s.id=p.sistema_id and s.cliente_id=p_cliente_id and s.deleted_at is null))
       or (p.equipamento_id is not null and not exists(select 1 from pcm.equipamentos e where e.id=p.equipamento_id and e.client_id=p_cliente_id and e.deleted_at is null)) then 'alvo_indisponivel'
     when exists(select 1 from pcm.planos_manutencao outro where outro.id=p.id and outro.cliente_id is distinct from p_cliente_id) then 'destino_ocupado'
     when m.plano_id is not null and novo.id is null then 'mapeamento_inconsistente'
     when m.plano_id is not null and m.cliente_id is distinct from p_cliente_id then 'mapeamento_inconsistente'
     when m.plano_id is not null and (not exists(select 1 from pcm.plano_versoes v where v.id=m.versao_id and v.plano_id=p.id)
       or not exists(select 1 from pcm.rotinas_manutencao r where r.id=m.rotina_id and r.plano_id=p.id and r.versao_id=m.versao_id)) then 'mapeamento_inconsistente'
     when m.plano_id is not null and to_jsonb(p) is distinct from m.payload->'fotografia' then 'origem_alterada'
     when m.plano_id is not null then 'rascunho_registrado'
     when novo.id is not null then 'destino_sem_mapeamento'
     else 'sem_destino_observado' end::text
 from pcm.planos_preventivos p
 left join pcm.planos_manutencao novo on novo.id=p.id and novo.cliente_id=p_cliente_id
 left join pcm.sso_rascunhos_planos_legados m on m.plano_legado_id=p.id
 where p.cliente_id=p_cliente_id and (p_apos is null or p.id>p_apos)
 order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_prever_mapeamento_planos(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_prever_mapeamento_planos(uuid,uuid,uuid,integer) to authenticated;
