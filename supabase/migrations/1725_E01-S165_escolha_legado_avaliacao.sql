-- ADR-1581: somente escolha explícita e atual pode tratar a ocorrência legada específica.
create function pcm.sso_legada_resolvida_por_escolha_rascunho(
 p_cliente uuid,p_plano uuid,p_rascunho uuid,p_revisao integer,p_legada uuid
) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_leg pcm.ocorrencias_preventivas%rowtype;v_e pcm.sso_escolhas_reserva_futura_rascunho%rowtype;
 v_count integer;v_request uuid;v_foto jsonb;v_visita uuid;
begin
 if p_cliente is null or p_plano is null or p_rascunho is null or p_revisao is null or p_legada is null then return false;end if;
 select l.* into v_leg from pcm.ocorrencias_preventivas l join pcm.planos_preventivos p on p.id=l.plano_id and p.cliente_id=p_cliente
  where l.id=p_legada for share of l,p nowait;
 if not found or v_leg.origem is distinct from 'legado' or v_leg.envio_estado is distinct from 'prevista'
  or v_leg.auvo_task_id is not null or v_leg.resultado_estado is distinct from 'pendente'
  or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=v_leg.id) then return false;end if;
 -- O mesmo critério de última escolha das duas selagens, sem atribuir um índice a mais de uma Rotina.
 with calendario as (
  select distinct on (e.rotina_id,e.data_sso,e.legado_id,e.indice_legado) e.*
  from pcm.sso_escolhas_reserva_futura_rascunho e
  where e.cliente_id=p_cliente and e.plano_id=p_plano and e.rascunho_id=p_rascunho and e.modo='calendario'
  order by e.rotina_id,e.data_sso,e.legado_id,e.indice_legado,e.revisao_escolha desc
 ), visita as (
  select distinct on (e.rotina_id,e.data_sso) e.*
  from pcm.sso_escolhas_reserva_futura_rascunho e
  where e.cliente_id=p_cliente and e.plano_id=p_plano and e.rascunho_id=p_rascunho and e.modo='visita'
  order by e.rotina_id,e.data_sso,e.revisao_escolha desc
 ), candidatos as (select * from calendario union all select * from visita)
 select count(*),min(request_id::text)::uuid into v_count,v_request from candidatos
  where legado_id=v_leg.plano_id and indice_legado=v_leg.indice;
 if v_count<>1 then return false;end if;
 select * into v_e from pcm.sso_escolhas_reserva_futura_rascunho where request_id=v_request;
 if not found or v_e.revisao_plano is distinct from p_revisao or v_e.decisao is distinct from 'somente_legado' then return false;end if;
 if v_e.modo='calendario' then
  v_foto:=pcm.sso_prever_reserva_calendario_rascunho(auth.uid(),p_cliente,p_plano,p_rascunho,v_e.rotina_id,v_e.indice_sso,v_e.legado_id,v_e.indice_legado,p_revisao)->'foto';
  return (v_foto-'escolhaRevisao'-'escolhaDecisao') is not distinct from (v_e.foto-'escolhaRevisao'-'escolhaDecisao')
   and (v_foto->>'escolhaRevisao')::integer is not distinct from v_e.revisao_escolha and v_foto->>'escolhaDecisao' is not distinct from v_e.decisao
   and coalesce((v_foto->>'efeitoLegado')::boolean,true)=false and coalesce((v_foto->>'efeitoSso')::boolean,true)=false;
 elsif v_e.modo='visita' then
  select visita_id into v_visita from pcm.sso_escolhas_reserva_visita_detalhes where request_id=v_e.request_id;
  if v_visita is null then return false;end if;
  v_foto:=pcm.sso_prever_reserva_visita_rascunho(auth.uid(),p_cliente,p_plano,p_rascunho,v_e.rotina_id,v_visita,v_e.legado_id,v_e.indice_legado,p_revisao)->'foto';
  return v_foto is not distinct from v_e.foto and coalesce((v_foto->'efeitos'->>'efeitoLegado')::boolean,true)=false
   and coalesce((v_foto->'efeitos'->>'osLegada')::boolean,true)=false and coalesce((v_foto->>'efeitoSso')::boolean,true)=false;
 end if;
 return false;
exception when check_violation or serialization_failure or invalid_parameter_value then return false;
end; $$;
revoke all on function pcm.sso_legada_resolvida_por_escolha_rascunho(uuid,uuid,uuid,integer,uuid) from public,anon,authenticated,service_role;

-- O avaliador instalado preserva todas as outras fontes e só subtrai o índice comprovado.
alter function pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer) volatile;
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)'::regprocedure);
 a text:='where not exists(select 1 from pcm.ocorrencias_rotina_vinculos c join pcm.ocorrencias_rotina_preparadas o on o.id=c.ocorrencia_preparada_id and o.plano_id=p_plano_id where c.ocorrencia_legada_id=l.id)';
 b text:='where not pcm.sso_legada_resolvida_por_escolha_rascunho(p_cliente_id,p_plano_id,v_rascunho,p_expected_plano,l.id) and not exists(select 1 from pcm.ocorrencias_rotina_vinculos c join pcm.ocorrencias_rotina_preparadas o on o.id=c.ocorrencia_preparada_id and o.plano_id=p_plano_id where c.ocorrencia_legada_id=l.id)';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'avaliacao_legada_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
