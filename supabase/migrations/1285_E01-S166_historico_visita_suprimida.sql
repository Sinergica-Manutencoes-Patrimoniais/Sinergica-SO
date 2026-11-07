-- ADR-1126: histórico inclui ID da Visita preservada quando houver associação.
create function pcm.sso_listar_supressoes_feriado_v2(p_ator_id uuid,p_cliente_id uuid,p_feriado_id uuid,p_apos uuid,p_limite integer)
returns table(supressao_id uuid,serie_id uuid,regra_id uuid,semana_origem date,data_contratual date,feriado_ativo boolean,revogada boolean,criado_em timestamptz,visita_suprimida_id uuid)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 return query select s.supressao_id,s.serie_id,s.regra_id,s.semana_origem,s.data_contratual,s.feriado_ativo,s.revogada,s.criado_em,v.visita_id
  from pcm.sso_listar_supressoes_feriado(p_ator_id,p_cliente_id,p_feriado_id,p_apos,p_limite) s
  left join pcm.sso_visitas_suprimidas_feriado v on v.supressao_id=s.supressao_id and v.cliente_id=p_cliente_id order by s.supressao_id;
end; $$;
revoke all on function pcm.sso_listar_supressoes_feriado_v2(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_supressoes_feriado_v2(uuid,uuid,uuid,uuid,integer) to authenticated;
