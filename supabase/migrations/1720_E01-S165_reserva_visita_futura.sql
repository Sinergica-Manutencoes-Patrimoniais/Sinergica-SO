-- ADR-1576: Visita futura existente, sem preparar ocorrência nem criar Visita.
create function pcm.sso_prever_reserva_visita_futura(p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_visita uuid,p_legado uuid,p_indice_legado integer,p_revisao_plano integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p pcm.planos_manutencao%rowtype;ver pcm.plano_versoes%rowtype;leg pcm.planos_preventivos%rowtype;vi pcm.visitas%rowtype;orig pcm.visita_origem_contratual%rowtype;reg pcm.regras_visita_contratual%rowtype;rot jsonb;n integer;v_data date;v_data_legado date;v_hoje date;v_ciclo uuid;v_foto jsonb;v_efeitos jsonb;v_res pcm.sso_reservas_ciclo_legado%rowtype;v_conflito boolean;
begin
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 if p_indice_legado is null or p_indice_legado<0 or p_visita is null or p_revisao_plano is null then raise exception 'candidato_invalido' using errcode='22023';end if;
 lock table pcm.visitas,pcm.visita_origem_contratual,pcm.regras_visita_contratual,pcm.sso_visita_regra_transicoes,pcm.feriados_declarados,pcm.sso_visitas_suprimidas_feriado,pcm.visita_ordens_servico,pcm.rotina_visita_serie_vinculos,pcm.rotina_serie_vigencias,pcm.sso_ciclos_visita_canonicos,pcm.sso_ciclo_visita_versoes,pcm.ocorrencias_visita_preparadas,pcm.sso_reservas_ciclo_legado,pcm.ocorrencias_preventivas,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait;
 select * into p from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found or p.revisao is distinct from p_revisao_plano then raise exception 'plano_ou_revisao_indisponivel' using errcode='40001';end if;
 select * into ver from pcm.plano_versoes where id=p_versao and plano_id=p_plano and estado='aprovado' for share nowait;
 if not found or jsonb_typeof(ver.snapshot->'rotinas') is distinct from 'array' then raise exception 'versao_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into n,rot from jsonb_array_elements(ver.snapshot->'rotinas') x(item) where item->>'id'=p_rotina::text;
 if n<>1 or rot->>'modo' is distinct from 'visita' then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 select * into vi from pcm.visitas where id=p_visita and cliente_id=p_cliente for share;
 if not found or vi.natureza<>'regular' or vi.estado not in ('rascunho','planejada','confirmada') then raise exception 'visita_indisponivel' using errcode='23514';end if;
 select * into orig from pcm.visita_origem_contratual where visita_id=vi.id and cliente_id=p_cliente;
 if not found then raise exception 'origem_visita_indisponivel' using errcode='23514';end if;
 select * into reg from pcm.regras_visita_contratual where id=pcm.sso_regra_efetiva_visita(vi.id) and serie_id=orig.serie_id;
 if not found or reg.fuso is distinct from vi.fuso or not exists(select 1 from pg_catalog.pg_timezone_names where name=vi.fuso) then raise exception 'regra_indisponivel' using errcode='23514';end if;
 v_data:=orig.semana_origem+(reg.dia_semana-1);v_hoje:=pcm.sso_data_civil_versao_geracao(p_plano,p_versao);
 if v_data<v_hoje or v_data>v_hoje+730 or ver.vigencia_inicio is null or v_data<ver.vigencia_inicio or (ver.vigencia_fim is not null and v_data>ver.vigencia_fim)
 or (vi.inicio_em at time zone vi.fuso)::date is distinct from v_data or orig.semana_origem<reg.ancora_semana or mod(orig.semana_origem-reg.ancora_semana,7*reg.intervalo_semanas)<>0 or v_data<reg.vigencia_inicio or (reg.vigencia_fim is not null and v_data>reg.vigencia_fim)
 or not exists(select 1 from pcm.rotina_visita_serie_vinculos l join pcm.rotina_serie_vigencias g on g.plano_id=l.plano_id and g.rotina_logica_id=l.rotina_logica_id and g.serie_id=l.serie_id where l.plano_id=p_plano and l.rotina_logica_id=(rot->>'rotina_logica_id')::uuid and l.serie_id=orig.serie_id and g.inicio<=v_data and (g.fim is null or g.fim>=v_data))
 or exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente and f.ativo and f.data=v_data and (f.contrato_id is null or f.contrato_id=orig.contrato_id))
 or exists(select 1 from pcm.sso_visitas_suprimidas_feriado where visita_id=vi.id) or exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=vi.id and vo.encerrado_em is null) then raise exception 'visita_exige_reconciliacao' using errcode='23514';end if;
 select * into leg from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 if not ((rot->>'alvo_tipo'='sistema' and leg.sistema_id::text=rot->>'sistema_id') or (rot->>'alvo_tipo'='componente' and leg.equipamento_id::text=rot->>'equipamento_id')) then raise exception 'alvo_incompativel' using errcode='23514';end if;
 select c.id into v_ciclo from pcm.sso_ciclos_visita_canonicos c where c.plano_id=p_plano and c.rotina_logica_id=(rot->>'rotina_logica_id')::uuid and c.alvo_tipo=rot->>'alvo_tipo' and c.alvo_id=(case rot->>'alvo_tipo' when 'sistema' then rot->>'sistema_id' when 'componente' then rot->>'equipamento_id' end)::uuid and c.serie_id=orig.serie_id and c.semana_origem=orig.semana_origem;
 v_data_legado:=pcm.sso_vencimento_ciclo_calendario(leg.primeira_data,leg.intervalo_n,leg.intervalo_unidade,p_indice_legado);
 select * into v_res from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo='visita' and r.ciclo_id=v_ciclo) or (r.legado_id=p_legado and r.indice_legado=p_indice_legado)) order by r.criado_em desc limit 1;
 v_conflito:=(select count(*) from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo='visita' and r.ciclo_id=v_ciclo) or (r.legado_id=p_legado and r.indice_legado=p_indice_legado)))>1 or (v_res.id is not null and (v_res.cliente_id is distinct from p_cliente or v_res.plano_id is distinct from p_plano or v_res.modo is distinct from 'visita' or v_res.ciclo_id is distinct from v_ciclo or v_res.legado_id is distinct from p_legado or v_res.indice_legado is distinct from p_indice_legado));
 v_efeitos:=jsonb_build_object('reservaConflitante',v_conflito,'reservaRevisao',case when v_res.id is not null and not v_conflito then v_res.revisao else 0 end,'reservaDecisao',case when v_res.id is not null and not v_conflito then v_res.decisao else null end,'legadaExistente',exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=p_legado and l.indice=p_indice_legado),'ssoPreparada',exists(select 1 from pcm.sso_ciclo_visita_versoes c where c.ciclo_id=v_ciclo),'ssoPossivelNaoIdentificada',exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.rotina_logica_id=(rot->>'rotina_logica_id')::uuid and o.alvo_tipo=rot->>'alvo_tipo' and o.alvo_id=(case rot->>'alvo_tipo' when 'sistema' then rot->>'sistema_id' when 'componente' then rot->>'equipamento_id' end)::uuid and o.serie_id=orig.serie_id and o.semana_origem=orig.semana_origem),'reservaExistente',exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo='visita' and r.ciclo_id=v_ciclo) or (r.legado_id=p_legado and r.indice_legado=p_indice_legado))));
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado)||jsonb_build_object('efeitos',v_efeitos,'dataReferenciaCivil',v_hoje,'modo','visita','versaoId',p_versao,'rotinaId',p_rotina,'regraSso',rot,'vigenciaInicio',ver.vigencia_inicio,'vigenciaFim',ver.vigencia_fim,'visita',to_jsonb(vi),'origemVisita',to_jsonb(orig),'regraVisita',to_jsonb(reg),'dataSso',v_data,'indiceLegado',p_indice_legado,'dataLegado',v_data_legado);
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 return jsonb_build_object('foto',v_foto,'equivalenciaComprovada',false,'fontesFeriadosCompletas',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false,'efeitos',v_efeitos);
end; $$;
revoke all on function pcm.sso_prever_reserva_visita_futura(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_decidir_reserva_visita_futura(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_visita uuid,p_legado uuid,p_indice_legado integer,p_revisao_plano integer,p_revisao_reserva integer,p_decisao text,p_confirmado boolean,p_motivo text,p_foto_esperada jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_rot jsonb;v_orig jsonb;v_ciclo uuid;v_res pcm.sso_reservas_ciclo_legado%rowtype;v_ant pcm.sso_reservas_ciclo_legado%rowtype;v_payload jsonb;v_foto jsonb;v_resultado jsonb;v_id uuid;v_legada uuid;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' or pg_catalog.current_setting('session_replication_role')<>'origin' then raise exception 'transacao_invalida' using errcode='25001';end if;
 if p_request is null or p_decisao is null or p_decisao not in ('somente_sso','somente_legado','integrar_ponte') or p_revisao_reserva is null or p_revisao_reserva<0 or p_confirmado is distinct from true or p_foto_esperada is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'decisao_invalida' using errcode='22023';end if;
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,true);
 v_payload:=jsonb_build_object('tipo','reservaVisitaFutura','cliente',p_cliente,'plano',p_plano,'versao',p_versao,'rotina',p_rotina,'visita',p_visita,'legado',p_legado,'indiceLegado',p_indice_legado,'revisaoPlano',p_revisao_plano,'revisaoReserva',p_revisao_reserva,'decisao',p_decisao,'motivo',v_motivo,'fotoEsperada',p_foto_esperada);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-request:'||p_request::text,0));
 select * into v_ant from pcm.sso_reservas_ciclo_legado where request_id=p_request;
 if found then if v_ant.ator_id is distinct from p_ator or v_ant.foto->'payload' is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return jsonb_build_object('requestId',p_request,'reservaId',v_ant.id,'cicloId',v_ant.ciclo_id,'revisao',v_ant.revisao,'decisao',v_ant.decisao,'replay',true,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 perform 1 from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for update nowait;if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 lock table pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_ciclo_visita_versoes,pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo in share mode nowait;
 v_previa:=pcm.sso_prever_reserva_visita_futura(p_ator,p_cliente,p_plano,p_versao,p_rotina,p_visita,p_legado,p_indice_legado,p_revisao_plano);
 if v_previa->'foto' is distinct from p_foto_esperada then raise exception 'fotografia_obsoleta' using errcode='40001';end if;
 if p_foto_esperada->'relacaoAtual'->>'decisao' is distinct from 'declarar' then raise exception 'relacao_positiva_necessaria' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_legados_nao_relacionados n where n.plano_id=p_plano and n.legado_id=p_legado and n.criado_em >= (select d.criado_em from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano and d.plano_legado_id=p_legado order by d.revisao desc limit 1)) then raise exception 'classificacao_negativa_exige_reconciliacao' using errcode='23514';end if;
 if p_decisao='integrar_ponte' and p_foto_esperada->>'dataSso' is distinct from p_foto_esperada->>'dataLegado' then raise exception 'ponte_datas_incompativeis' using errcode='23514';end if;
 v_rot:=p_foto_esperada->'regraSso';v_orig:=p_foto_esperada->'origemVisita';
 insert into pcm.sso_ciclos_visita_canonicos(plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem)
 values(p_plano,(v_rot->>'rotina_logica_id')::uuid,v_rot->>'alvo_tipo',(case v_rot->>'alvo_tipo' when 'sistema' then v_rot->>'sistema_id' when 'componente' then v_rot->>'equipamento_id' end)::uuid,(v_orig->>'serie_id')::uuid,(v_orig->>'semana_origem')::date)
 on conflict(plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem) do nothing;
 select id into v_ciclo from pcm.sso_ciclos_visita_canonicos where plano_id=p_plano and rotina_logica_id=(v_rot->>'rotina_logica_id')::uuid and alvo_tipo=v_rot->>'alvo_tipo' and alvo_id=(case v_rot->>'alvo_tipo' when 'sistema' then v_rot->>'sistema_id' when 'componente' then v_rot->>'equipamento_id' end)::uuid and serie_id=(v_orig->>'serie_id')::uuid and semana_origem=(v_orig->>'semana_origem')::date;
 if v_ciclo is null then raise exception 'identidade_divergente' using errcode='23514';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-ciclo:visita:'||v_ciclo::text,0)) then raise exception 'ciclo_em_uso' using errcode='55P03';end if;
 if coalesce((v_previa->'efeitos'->>'ssoPossivelNaoIdentificada')::boolean,false) then raise exception 'preparada_existente_exige_reconciliacao' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_ciclo_visita_versoes where ciclo_id=v_ciclo) then raise exception 'ciclo_ja_preparado_use_fluxo_existente' using errcode='23514';end if;
 select id into v_legada from pcm.ocorrencias_preventivas where plano_id=p_legado and indice=p_indice_legado for update nowait;
 if v_legada is not null and (p_decisao='somente_sso' or exists(select 1 from pcm.ocorrencias_preventivas l where l.id=v_legada and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente')) or exists(select 1 from pcm.ordens_servico where ocorrencia_preventiva_id=v_legada)) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
 select * into v_res from pcm.sso_reservas_ciclo_legado where legado_id=p_legado and indice_legado=p_indice_legado and ativa for update nowait;
 if found and (v_res.cliente_id is distinct from p_cliente or v_res.plano_id is distinct from p_plano or v_res.modo is distinct from 'visita' or v_res.ciclo_id is distinct from v_ciclo) then raise exception 'reserva_conflitante' using errcode='23505';end if;
 if coalesce(v_res.revisao,0)<>p_revisao_reserva then raise exception 'reserva_obsoleta' using errcode='40001';end if;
 if v_res.id is not null then update pcm.sso_reservas_ciclo_legado set ativa=false where id=v_res.id;end if;
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado);
 insert into pcm.sso_reservas_ciclo_legado(request_id,cliente_id,plano_id,legado_id,indice_legado,modo,ciclo_id,preparada_id,decisao,foto,motivo,revisao,ator_id) values(p_request,p_cliente,p_plano,p_legado,p_indice_legado,'visita',v_ciclo,null,p_decisao,v_foto||jsonb_build_object('payload',v_payload,'confirmacao',p_foto_esperada),v_motivo,p_revisao_reserva+1,p_ator) returning id into v_id;
 v_resultado:=jsonb_build_object('requestId',p_request,'reservaId',v_id,'cicloId',v_ciclo,'revisao',p_revisao_reserva+1,'decisao',p_decisao,'replay',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'visita.reserva_ciclo_futuro','planos_manutencao',p_plano,v_resultado||jsonb_build_object('motivo',v_motivo,'payload',v_payload));return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_reserva_visita_futura(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text,jsonb) from public,anon,authenticated,service_role;

grant execute on function pcm.sso_prever_reserva_visita_futura(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;
grant execute on function pcm.sso_decidir_reserva_visita_futura(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text,jsonb) to authenticated;
