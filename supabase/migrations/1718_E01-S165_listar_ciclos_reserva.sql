-- ADR-1574: inclui preparadas com e sem ponte, sem presumir equivalência.
create function pcm.sso_listar_ciclos_reserva_legado(p_ator uuid,p_cliente uuid,p_plano uuid,p_modo text,p_apos uuid,p_limite integer)
returns table(preparada_id uuid,vencimento_original date,alvo_tipo text,alvo_id uuid)
language plpgsql volatile security definer set search_path='' as $$
begin
 if p_modo is null or p_modo not in ('calendario','visita') or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if p_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);else perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);end if;
 if not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano and p.cliente_id=p_cliente) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_modo='calendario' then
  return query select o.id,o.vencimento_original,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_rotina_preparadas o join pcm.sso_ciclo_calendario_versoes c on c.preparada_id=o.id where o.plano_id=p_plano and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
 else
  return query select o.id,o.vencimento_original,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_visita_preparadas o join pcm.sso_ciclo_visita_versoes c on c.preparada_id=o.id where o.plano_id=p_plano and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
 end if;
 if p_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);else perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);end if;
end; $$;
revoke all on function pcm.sso_listar_ciclos_reserva_legado(uuid,uuid,uuid,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_ciclos_reserva_legado(uuid,uuid,uuid,text,uuid,integer) to authenticated;
