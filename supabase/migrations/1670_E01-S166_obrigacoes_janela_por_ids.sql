-- ADR-1527: consulta direta dos recibos, sem varredura de todo o Plano.
create function pcm.sso_obrigacoes_calendario_por_ids(p_cliente_id uuid,p_plano_id uuid,p_preparadas uuid[])
returns table(tipo text,preparada_id uuid,versao_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,vencimento_original date,ocorrencia_grupo_id uuid,estado text,fila_executavel boolean)
language plpgsql volatile security definer set search_path='' as $$
declare v_total integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_preparadas is null or cardinality(p_preparadas) not between 1 and 775 or array_position(p_preparadas,null) is not null
  or (select count(distinct x) from unnest(p_preparadas) x)<>cardinality(p_preparadas) then raise exception 'selecao_invalida' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_obrigacoes_preparadas_mediadas_gate where id and habilitado for share;
 if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fila_obrigacoes_preparadas_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 lock table pcm.ocorrencias_rotina_preparadas,pcm.sso_ocorrencias_grupo in share mode nowait;
 select count(*) into v_total from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano_id and o.id=any(p_preparadas);
 if v_total<>cardinality(p_preparadas) then raise exception 'ocorrencias_indisponiveis' using errcode='42501'; end if;
 return query select 'calendario'::text,o.id,o.versao_id,o.rotina_id,o.alvo_tipo,o.alvo_id,o.vencimento_original,g.id,
  case when g.id is not null then 'grupo_registrado_nao_executavel' when o.alvo_tipo='grupo' then 'grupo_preparado_sem_registro' else 'preparada_sem_estado_execucao' end,false
 from pcm.ocorrencias_rotina_preparadas o left join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=o.id and g.cliente_id=p_cliente_id and g.plano_id=p_plano_id
 where o.plano_id=p_plano_id and o.id=any(p_preparadas) order by o.id;
end; $$;
revoke all on function pcm.sso_obrigacoes_calendario_por_ids(uuid,uuid,uuid[]) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_obrigacoes_calendario_por_ids(uuid,uuid,uuid[]) to authenticated;
