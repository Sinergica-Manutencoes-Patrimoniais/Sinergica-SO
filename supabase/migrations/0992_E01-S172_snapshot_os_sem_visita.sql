-- ADR-0794: OS abertas sem Visita, sem atribuir semana quando faltam dados.
create function pcm.sso_fuso_origem_os_capacidade(p_cliente_id uuid,p_ocorrencia_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_origem jsonb;v_fuso text;
begin
 if p_ocorrencia_id is null then return null;end if;
 v_origem:=pcm.sso_resolver_origem_execucao(p_cliente_id,p_ocorrencia_id);
 select snapshot->'fuso_plano'->>'fuso' into v_fuso from pcm.plano_versoes
  where id=(v_origem->>'versaoId')::uuid and plano_id=(v_origem->>'planoId')::uuid and estado='aprovado';
 if v_fuso is null or not exists(select 1 from pg_catalog.pg_timezone_names t where t.name=v_fuso) then return null;end if;
 return jsonb_build_object('tipo',v_origem->>'tipo','origemId',v_origem->>'preparadaId','fuso',v_fuso);
exception when sqlstate '23514' or sqlstate '42501' or sqlstate '55000' then return null;
end; $$;
revoke all on function pcm.sso_fuso_origem_os_capacidade(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_os_sem_visita_capacidade(p_cliente_id uuid,p_semana_inicio date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_linhas jsonb;v_total integer;v_pendentes integer;
begin
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 then raise exception 'consulta_invalida' using errcode='22023';end if;
 with base as (
  select os.id os_id,os.status os_status,os.data_agendada,os.ocorrencia_preventiva_id ocorrencia_legada_id,leg.vencimento vencimento_original,
   origem.dados->>'tipo' tipo,origem.dados->>'origemId' origem_id,origem.dados->>'fuso' fuso,
   case when os.data_agendada is not null and origem.dados is not null
     then (os.data_agendada at time zone (origem.dados->>'fuso'))::date
     when os.data_agendada is null then leg.vencimento else null end data_referencia
  from pcm.ordens_servico os
  left join pcm.ocorrencias_preventivas leg on leg.id=os.ocorrencia_preventiva_id and exists(select 1 from pcm.planos_preventivos lp where lp.id=leg.plano_id and lp.cliente_id=p_cliente_id)
  left join lateral (select case when os.data_agendada is not null then pcm.sso_fuso_origem_os_capacidade(p_cliente_id,os.ocorrencia_preventiva_id) end dados offset 0) origem on true
  where os.client_id=p_cliente_id and os.deleted_at is null and os.status not in ('finalizado','cancelado')
   and not exists(select 1 from pcm.visita_ordens_servico vo where vo.os_id=os.id and vo.encerrado_em is null)
 ), selecionadas as (
  select b.*,coalesce(e.revisao,0) esforco_revision,e.internos_minutos,e.terceiros_minutos,e.acompanhamento_minutos
  from base b left join lateral (select d.revisao,d.internos_minutos,d.terceiros_minutos,d.acompanhamento_minutos from pcm.capacidade_esforco_declaracoes d where d.cliente_id=p_cliente_id and d.os_id=b.os_id order by d.revisao desc limit 1) e on true
  where b.data_referencia>=p_semana_inicio and b.data_referencia<p_semana_inicio+7 order by b.os_id limit 100
 )
 select coalesce((select jsonb_agg(to_jsonb(s) order by s.os_id) from selecionadas s),'[]'::jsonb),
  (select count(*) from selecionadas),(select count(*) from base where data_referencia is null)
 into v_linhas,v_total,v_pendentes;
 return jsonb_build_object('osSemVisita',v_linhas,'limiteOsSemVisitaAtingido',v_total=100,'pendentesSemSemana',v_pendentes);
end; $$;
revoke all on function pcm.sso_os_sem_visita_capacidade(uuid,date) from public,anon,authenticated,service_role;

create function pcm.sso_mediar_snapshot_capacidade_v2(p_cliente_id uuid,p_semana_inicio date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_base jsonb;v_adicional jsonb;
begin
 v_base:=pcm.sso_mediar_snapshot_capacidade(p_cliente_id,p_semana_inicio);
 v_adicional:=pcm.sso_os_sem_visita_capacidade(p_cliente_id,p_semana_inicio);
 return v_base||v_adicional;
end; $$;
revoke all on function pcm.sso_mediar_snapshot_capacidade_v2(uuid,date) from public,anon,service_role;
grant execute on function pcm.sso_mediar_snapshot_capacidade_v2(uuid,date) to authenticated;
