-- ADR-1496: classificação humana posterior à aprovação, para agendamentos na data do ciclo.
create function pcm.sso_contexto_conferencia_pmoc_ciclo(p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_revisao integer,p_data date,p_decisao boolean)
returns void language plpgsql volatile security definer set search_path='' as $$
begin
 if p_data is null or not isfinite(p_data) then raise exception 'data_invalida' using errcode='22023';end if;
 perform pcm.sso_conferir_pmoc_mediado(p_ator,p_cliente,p_decisao);
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;if not found then raise exception 'operacao_desabilitada' using errcode='55000';end if;
 perform pcm.sso_contexto_origem_rotina(p_ator,p_cliente,p_plano,p_versao,p_rotina,p_revisao);
 if (select count(*) from pcm.plano_versoes v where v.plano_id=p_plano and v.estado='aprovado' and v.vigencia_inicio<=p_data and (v.vigencia_fim is null or v.vigencia_fim>=p_data))<>1
  or not exists(select 1 from pcm.plano_versoes v where v.id=p_versao and v.plano_id=p_plano and v.estado='aprovado' and v.vigencia_inicio<=p_data and (v.vigencia_fim is null or v.vigencia_fim>=p_data)) then raise exception 'vigencia_indeterminada' using errcode='23514';end if;
 if exists(select 1 from pcm.plano_versoes v cross join lateral jsonb_array_elements(v.snapshot->'rotinas') r(item) where v.id=p_versao and r.item->>'id'=p_rotina::text and r.item->>'modo'='calendario') then
  if not exists(select 1 from pcm.sso_prever_ciclos_rotina(p_plano,p_versao,p_rotina,p_data,p_data) c where c.vencimento=p_data) then raise exception 'vencimento_nao_e_ciclo' using errcode='23514';end if;
 elsif exists(select 1 from pcm.plano_versoes v cross join lateral jsonb_array_elements(v.snapshot->'rotinas') r(item) where v.id=p_versao and r.item->>'id'=p_rotina::text and r.item->>'modo'='visita') then
  if config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
  if not exists(select 1 from pcm.visita_origem_contratual o join pcm.visitas vi on vi.id=o.visita_id and vi.cliente_id=o.cliente_id
   join pcm.regras_visita_contratual r on r.id=pcm.sso_regra_efetiva_visita(o.visita_id) and r.serie_id=o.serie_id
   join pcm.rotinas_manutencao ro on ro.id=p_rotina and ro.plano_id=p_plano and ro.versao_id=p_versao and ro.modo='visita'
   join pcm.rotina_visita_serie_vinculos l on l.plano_id=p_plano and l.rotina_logica_id=ro.rotina_logica_id and l.serie_id=o.serie_id
   where o.cliente_id=p_cliente and vi.estado not in ('cancelada','concluida') and o.semana_origem+(r.dia_semana-1)=p_data
    and o.semana_origem>=r.ancora_semana and mod(o.semana_origem-r.ancora_semana,7*r.intervalo_semanas)=0
    and p_data>=r.vigencia_inicio and (r.vigencia_fim is null or p_data<=r.vigencia_fim)
    and exists(select 1 from pcm.rotina_serie_vigencias g where g.plano_id=p_plano and g.rotina_logica_id=ro.rotina_logica_id and g.serie_id=o.serie_id and g.inicio<=p_data and (g.fim is null or g.fim>=p_data))
    and not exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente and f.ativo and f.data=p_data and (f.contrato_id is null or f.contrato_id=o.contrato_id))) then raise exception 'vencimento_nao_e_visita' using errcode='23514';end if;
 else raise exception 'modo_indisponivel' using errcode='23514';end if;
end; $$;
revoke all on function pcm.sso_contexto_conferencia_pmoc_ciclo(uuid,uuid,uuid,uuid,uuid,integer,date,boolean) from public,anon,authenticated,service_role;

create function pcm.sso_listar_pmoc_ciclo_conferencia(p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_vencimento date,p_apos uuid,p_limite integer)
returns table(agendamento_id uuid,revisao_decisao integer,classificacao text,fotografia_atual boolean,fotografia jsonb) language plpgsql volatile security definer set search_path='' as $$
begin
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023';end if;
 perform pcm.sso_contexto_conferencia_pmoc_ciclo(p_ator_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_vencimento,false);
 return query select s.id,coalesce(d.revisao,0),d.classificacao,coalesce(d.fotografia=pcm.sso_foto_inventario_pmoc(p_cliente_id,s.id),false),pcm.sso_foto_inventario_pmoc(p_cliente_id,s.id)
 from pcm.pmoc_schedules s join pcm.pmoc_properties p on p.id=s.property_id and p.client_id=p_cliente_id
 left join lateral (select x.* from pcm.sso_classificacoes_pmoc_revisao x where x.rascunho_id=p_versao_id and x.agendamento_id=s.id order by x.revisao desc limit 1) d on true
 where s.scheduled_date=p_vencimento and s.status<>'cancelado' and (p_apos is null or s.id>p_apos) order by s.id limit p_limite;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
end; $$;
revoke all on function pcm.sso_listar_pmoc_ciclo_conferencia(uuid,uuid,uuid,uuid,uuid,integer,date,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_listar_pmoc_ciclo_conferencia(uuid,uuid,uuid,uuid,uuid,integer,date,uuid,integer) to authenticated;

create function pcm.sso_classificar_pmoc_ciclo(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_vencimento date,p_agendamento_id uuid,p_expected_decisao integer,p_expected_fotografia jsonb,p_evidencia text,p_motivo text,p_classificacao text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_classificacoes_pmoc_revisao%rowtype;v_payload jsonb;v_foto jsonb;v_rev integer;v_resultado jsonb;v_evidencia text:=nullif(btrim(p_evidencia),'');v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if p_classificacao is null or p_classificacao not in ('relacionado','nao_relacionado') or p_request_id is null or p_agendamento_id is null or p_expected_decisao is null or p_expected_decisao<0 or p_expected_fotografia is null or jsonb_typeof(p_expected_fotografia)<>'object' or v_evidencia is null or length(v_evidencia)>500 or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_pmoc_mediado(p_ator_id,p_cliente_id,true);
 perform 1 from pcm.sso_origem_lote_gate where id and habilitado for share;if not found then raise exception 'operacao_desabilitada' using errcode='55000';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-inventario-pmoc:'||p_request_id::text,0)) then raise exception 'comando_em_andamento' using errcode='55P03';end if;
 v_payload:=jsonb_build_object('operacao','classificar_ciclo','clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'revisaoPlano',p_expected_revision,'vencimento',p_vencimento,'agendamentoId',p_agendamento_id,'revisaoDecisao',p_expected_decisao,'fotografiaEsperada',p_expected_fotografia,'classificacao',p_classificacao,'evidencia',v_evidencia,'motivo',v_motivo);
 select * into v_ant from pcm.sso_classificacoes_pmoc_revisao where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id and revisao=p_expected_revision for update nowait;if not found then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 perform pcm.sso_contexto_conferencia_pmoc_ciclo(p_ator_id,p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_vencimento,true);
 lock table pcm.pmoc_schedules,pcm.pmoc_properties,pcm.pmoc_contracts,pcm.sso_vinculos_ciclo_pmoc,pcm.sso_vinculo_pmoc_usos_versao,pcm.sso_decisoes_proposta_pmoc,pcm.rotina_origem_geracao in share mode nowait;
 v_foto:=pcm.sso_foto_inventario_pmoc(p_cliente_id,p_agendamento_id);
 if v_foto is null or v_foto->>'data' is distinct from p_vencimento::text or v_foto->>'estado'='cancelado' then raise exception 'agendamento_indisponivel' using errcode='23514';end if;
 if v_foto is distinct from p_expected_fotografia then raise exception 'fotografia_pmoc_alterada' using errcode='40001';end if;
 if v_foto->>'contratoConferidoId' is distinct from v_foto->>'contratoId' or v_foto->>'imovelExcluidoEm' is not null or v_foto->>'contratoExcluidoEm' is not null then raise exception 'cadeia_pmoc_inconsistente' using errcode='23514';end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_classificacoes_pmoc_revisao where rascunho_id=p_versao_id and agendamento_id=p_agendamento_id;
 if v_rev<>p_expected_decisao then raise exception 'revisao_decisao_obsoleta' using errcode='40001';end if;
 if p_classificacao='nao_relacionado' and exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.agendamento_id=p_agendamento_id and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true) then raise exception 'classificacao_diverge_de_vinculo_atual' using errcode='23514';end if;
 if p_classificacao='relacionado' and not exists(select 1 from pcm.sso_vinculos_ciclo_pmoc v where v.cliente_id=p_cliente_id and v.plano_id=p_plano_id and v.agendamento_id=p_agendamento_id and (v.versao_id=p_versao_id or exists(select 1 from pcm.sso_vinculo_pmoc_usos_versao u where u.vinculo_id=v.id and u.versao_id=p_versao_id)) and pcm.sso_foto_pmoc_valida(p_cliente_id,v.id,pcm.sso_foto_impacto_pmoc(p_cliente_id,v.id)) is true) then raise exception 'vinculo_pmoc_atual_necessario' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'agendamentoId',p_agendamento_id,'versaoId',p_versao_id,'revisao',v_rev+1,'classificacao',p_classificacao,'agendamentoAlterado',false,'osAlteradas',false);
 insert into pcm.sso_classificacoes_pmoc_revisao(request_id,cliente_id,plano_id,rascunho_id,agendamento_id,revisao_plano,revisao,classificacao,evidencia,motivo,fotografia,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,p_versao_id,p_agendamento_id,p_expected_revision,v_rev+1,p_classificacao,v_evidencia,v_motivo,v_foto,p_ator_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'plano.pmoc_classificado_versao_vigente','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('evidencia',v_evidencia,'motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_classificar_pmoc_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,uuid,integer,jsonb,text,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_classificar_pmoc_ciclo(uuid,uuid,uuid,uuid,uuid,uuid,integer,date,uuid,integer,jsonb,text,text,text) to authenticated;
