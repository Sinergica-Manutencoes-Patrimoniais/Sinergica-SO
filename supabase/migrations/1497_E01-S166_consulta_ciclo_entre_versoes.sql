-- ADR-1349: leitura de uso canônico sem tratar ausência como ausência de execução.
create function pcm.sso_consultar_uso_ciclo_versao(
  p_cliente_id uuid, p_plano_id uuid, p_versao_id uuid, p_rotina_id uuid, p_vencimento date
) returns table (ciclo_id uuid, preparada_id uuid, versao_origem_id uuid, alvo_tipo text, alvo_id uuid)
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform 1 from pcm.sso_identidade_ciclo_gate where id and habilitado for share;
  if not found then raise exception 'identidade_ciclo_bloqueada' using errcode = '55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null
    or p_rotina_id is null or p_vencimento is null or not isfinite(p_vencimento)
    or config.sso_autorizar_acao('plano.gerir', p_cliente_id) is distinct from true
    or not exists (select 1 from pcm.planos_manutencao p where p.id = p_plano_id and p.cliente_id = p_cliente_id) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return query
    select c.id, o.id, o.versao_id, o.alvo_tipo, o.alvo_id
    from pcm.sso_ciclo_canonico_usos_versao u
    join pcm.sso_ciclos_calendario_canonicos c on c.id = u.ciclo_id
    join pcm.sso_series_ciclo_calendario s on s.id = c.serie_id and s.plano_id = p_plano_id
    join pcm.rotinas_manutencao r on r.id = u.rotina_id and r.plano_id = p_plano_id
      and r.versao_id = u.versao_id and r.rotina_logica_id = s.rotina_logica_id
    join pcm.ocorrencias_rotina_preparadas o on o.id = u.preparada_id and o.plano_id = p_plano_id
      and o.rotina_logica_id = s.rotina_logica_id and o.alvo_tipo = s.alvo_tipo
      and o.alvo_id = s.alvo_id and o.ciclo = c.indice and o.vencimento_original = c.vencimento_original
    where u.versao_id = p_versao_id and u.rotina_id = p_rotina_id and c.vencimento_original = p_vencimento
      and r.alvo_tipo = s.alvo_tipo and coalesce(r.sistema_id, r.equipamento_id, r.grupo_id) = s.alvo_id
    order by c.id limit 2;
end; $$;
revoke all on function pcm.sso_consultar_uso_ciclo_versao(uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_uso_ciclo_versao(uuid,uuid,uuid,uuid,date) to authenticated;
