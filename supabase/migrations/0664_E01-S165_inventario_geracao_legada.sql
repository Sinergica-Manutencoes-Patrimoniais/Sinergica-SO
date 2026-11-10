-- ADR-0438: inventário de vínculos por ocorrência, sem inferir equivalência de Planos.
create function pcm.sso_inventariar_geracao_legada(p_cliente_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_total integer; v_sem_vinculo integer; v_com_vinculo integer; v_multiplos integer; v_divergentes integer;
begin
 if not coalesce((select habilitado from pcm.sso_guarda_geracao_plano_gate where id),false) then raise exception 'inventario_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 with planos as (
   select l.id,count(distinct o.plano_id) filter(where p.cliente_id=p_cliente_id) vinculados,
     count(distinct o.plano_id) filter(where p.cliente_id is distinct from p_cliente_id and o.plano_id is not null) divergentes
   from pcm.planos_preventivos l left join pcm.ocorrencias_preventivas leg on leg.plano_id=l.id
   left join pcm.ocorrencias_rotina_vinculos v on v.ocorrencia_legada_id=leg.id
   left join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id
   left join pcm.planos_manutencao p on p.id=o.plano_id
   where l.cliente_id=p_cliente_id group by l.id
 ) select count(*),count(*) filter(where vinculados=0),count(*) filter(where vinculados>0),count(*) filter(where vinculados>1),count(*) filter(where divergentes>0)
 into v_total,v_sem_vinculo,v_com_vinculo,v_multiplos,v_divergentes from planos;
 return jsonb_build_object('planosLegados',v_total,'semVinculoOcorrencia',v_sem_vinculo,'comVinculoOcorrencia',v_com_vinculo,'comMultiplosPlanosAssociadosPorOcorrencia',v_multiplos,'comDivergenciaCliente',v_divergentes,'equivalenciaPlanoComprovada',false,'guardaLegadaAtivada',false,'fontesIncompletas',true);
end; $$;
revoke all on function pcm.sso_inventariar_geracao_legada(uuid) from public,anon,authenticated,service_role;
