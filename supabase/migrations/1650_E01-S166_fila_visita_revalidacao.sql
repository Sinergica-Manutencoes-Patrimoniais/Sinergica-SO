-- ADR-1507: consulta atual é distinta do estado histórico da fila.
create function pcm.sso_situacao_fila_visita(p_cliente uuid,p_plano uuid,p_preparada uuid,p_ciclo uuid,p_estado text)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v_oc pcm.ocorrencias_visita_preparadas%rowtype;
begin
 if p_estado='cancelado' then return 'cancelada'; end if;
 if p_estado<>'aguardando' then return 'verificacao'; end if;
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return 'verificacao'; end if;
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;
 if not found then return 'verificacao'; end if;
 select o.* into v_oc from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id
  where o.id=p_preparada and o.plano_id=p_plano and p.cliente_id=p_cliente and p.estado in ('aprovado','ativo');
 if not found then return 'verificacao'; end if;
 if not exists(select 1 from pcm.visitas v join pcm.visita_origem_contratual origem on origem.visita_id=v.id and origem.cliente_id=v.cliente_id
   where v.id=v_oc.visita_id and v.cliente_id=p_cliente and v.estado not in ('cancelada','concluida')
   and origem.serie_id=v_oc.serie_id and origem.semana_origem=v_oc.semana_origem)
   or exists(select 1 from pcm.sso_visitas_suprimidas_feriado where visita_id=v_oc.visita_id) then return 'verificacao'; end if;
 begin
  perform pcm.sso_exigir_vigencia_ocorrencia_legada(p_cliente,p_preparada,'visita');
 exception when check_violation or no_data_found then return 'verificacao'; end;
 if pcm.sso_estado_fila_visita(p_cliente,p_plano,p_ciclo)='candidata' then return 'conferida'; end if;
 return 'verificacao';
end; $$;
revoke all on function pcm.sso_situacao_fila_visita(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_fila_visita_cronologica_v2(
 p_cliente_id uuid,p_plano_id uuid,p_estado text,p_inicio date,p_fim date,p_apos_vencimento date,p_apos_ciclo uuid,p_limite integer
) returns table(ciclo_id uuid,preparada_id uuid,estado text,revisao integer,vencimento date,atualizado_em timestamptz,
 rotina_id uuid,rotina_nome text,alvo_tipo text,alvo_id uuid,versao_origem_id uuid,visita_id uuid,situacao_atual text)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
  or not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_fila_visita_gate where id and habilitado for share;
 if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
 lock table pcm.planos_manutencao,pcm.plano_versoes,pcm.ocorrencias_visita_preparadas,pcm.sso_ciclo_visita_versoes,
  pcm.sso_vinculos_visita_legado,pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico,
  pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo,pcm.sso_vinculos_os_grupo,pcm.sso_visitas_suprimidas_feriado,
  pcm.visitas,pcm.visita_origem_contratual in share mode nowait;
 return query select f.ciclo_id,f.preparada_id,f.estado,f.revisao,f.vencimento,f.atualizado_em,
  f.rotina_id,f.rotina_nome,f.alvo_tipo,f.alvo_id,f.versao_origem_id,f.visita_id,
  pcm.sso_situacao_fila_visita(p_cliente_id,p_plano_id,f.preparada_id,f.ciclo_id,f.estado)
 from pcm.sso_listar_fila_visita_cronologica(p_cliente_id,p_plano_id,p_estado,p_inicio,p_fim,p_apos_vencimento,p_apos_ciclo,p_limite) f;
end; $$;
revoke all on function pcm.sso_listar_fila_visita_cronologica_v2(uuid,uuid,text,date,date,date,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_fila_visita_cronologica_v2(uuid,uuid,text,date,date,date,uuid,integer) to authenticated;

create function pcm.sso_consultar_fila_visita_v2(p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns table(ciclo_id uuid,preparada_id uuid,estado text,revisao integer,vencimento date,atualizado_em timestamptz,situacao_atual text)
language plpgsql volatile security definer set search_path='' as $$
begin
 if auth.uid() is null or p_cliente_id is null or p_plano_id is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
  or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
  or not exists(select 1 from pcm.planos_manutencao p where p.id=p_plano_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_fila_visita_gate where id and habilitado for share;
 if not found then raise exception 'fila_desabilitada' using errcode='55000'; end if;
 lock table pcm.planos_manutencao,pcm.plano_versoes,pcm.ocorrencias_visita_preparadas,pcm.sso_ciclo_visita_versoes,
  pcm.sso_vinculos_visita_legado,pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico,
  pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo,pcm.sso_vinculos_os_grupo,pcm.sso_visitas_suprimidas_feriado,
  pcm.visitas,pcm.visita_origem_contratual in share mode nowait;
 return query select f.ciclo_id,f.preparada_id,f.estado,f.revisao,f.vencimento,f.atualizado_em,
  pcm.sso_situacao_fila_visita(p_cliente_id,p_plano_id,f.preparada_id,f.ciclo_id,f.estado)
 from pcm.sso_consultar_fila_visita(p_cliente_id,p_plano_id,p_preparada_id) f;
end; $$;
revoke all on function pcm.sso_consultar_fila_visita_v2(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_fila_visita_v2(uuid,uuid,uuid) to authenticated;

-- Um novo Chamado não pode contornar cancelamento ou fonte que deixou de ser elegível.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_criar_chamado_ciclo_visita(uuid,uuid,uuid,uuid)'::regprocedure);
 v_antes text:=$antes$   if exists(select 1 from pcm.sso_ciclo_visita_versoes cv join pcm.sso_vinculos_visita_legado ponte$antes$;
 v_depois text:=$depois$   perform 1 from pcm.sso_fila_visita_gate where id and habilitado for share;
   if found then
    lock table pcm.sso_ciclo_visita_versoes,pcm.sso_ocorrencias_grupo,pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.sso_chamados_ciclo_visita in share mode nowait;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fila-visita-ciclo:'||v_ciclo::text,0));
    if exists(select 1 from pcm.sso_fila_visita where ciclo_id=v_ciclo and estado<>'aguardando') then raise exception 'fila_visita_nao_aguardando' using errcode='23514'; end if;
    if exists(select 1 from pcm.sso_fila_visita where ciclo_id=v_ciclo and estado='aguardando')
      and pcm.sso_estado_fila_visita(p_cliente_id,p_plano_id,v_ciclo) is distinct from 'candidata' then raise exception 'fila_visita_fonte_alterada' using errcode='23514'; end if;
   end if;
   if exists(select 1 from pcm.sso_ciclo_visita_versoes cv join pcm.sso_vinculos_visita_legado ponte$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_chamado_visita_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
