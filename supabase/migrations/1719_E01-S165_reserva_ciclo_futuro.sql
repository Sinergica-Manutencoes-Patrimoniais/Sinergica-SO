-- ADR-1575. Reserva explícita de ciclo futuro; guardas e capacidades existentes permanecem obrigatórias.
alter table pcm.sso_reservas_ciclo_legado alter column preparada_id drop not null;

-- A prévia é somente leitura; o PCM escolhe os dois índices explicitamente.
create function pcm.sso_prever_reserva_calendario_futuro(
 p_ator uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_data date,
 p_legado uuid,p_indice_legado integer,p_revisao_plano integer
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_versao pcm.plano_versoes%rowtype;
 v_legado pcm.planos_preventivos%rowtype;v_rotina jsonb;v_n integer;v_ciclo integer;v_data_legado date;v_hoje date;v_foto jsonb;v_efeitos jsonb;v_serie uuid;v_canonico uuid;v_res pcm.sso_reservas_ciclo_legado%rowtype;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 if p_data is null or not isfinite(p_data)
  or p_indice_legado is null or p_indice_legado<0 or p_revisao_plano is null then
  raise exception 'candidato_invalido' using errcode='22023';end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found or v_plano.revisao is distinct from p_revisao_plano then raise exception 'plano_ou_revisao_indisponivel' using errcode='40001';end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao and plano_id=p_plano and estado='aprovado' for share nowait;
 if not found or p_data<v_versao.vigencia_inicio or (v_versao.vigencia_fim is not null and p_data>v_versao.vigencia_fim)
  or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'versao_indisponivel' using errcode='23514';end if;
 v_hoje:=pcm.sso_data_civil_versao_geracao(p_plano,p_versao);
 if p_data<v_hoje or p_data>v_hoje+730 then raise exception 'candidato_fora_da_janela' using errcode='22023';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'calendario' then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 select ciclo into v_ciclo from pcm.sso_prever_ciclos_rotina(p_plano,p_versao,p_rotina,p_data,p_data);
 if v_ciclo is null then raise exception 'data_nao_e_ciclo' using errcode='23514';end if;
 select * into v_legado from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 if not ((v_rotina->>'alvo_tipo'='sistema' and v_legado.sistema_id::text=v_rotina->>'sistema_id')
  or (v_rotina->>'alvo_tipo'='componente' and v_legado.equipamento_id::text=v_rotina->>'equipamento_id')) then
  raise exception 'alvo_incompativel' using errcode='23514';end if;
 select id into v_serie from pcm.sso_series_ciclo_calendario where plano_id=p_plano and rotina_logica_id=(v_rotina->>'rotina_logica_id')::uuid and alvo_tipo=v_rotina->>'alvo_tipo' and alvo_id=(case v_rotina->>'alvo_tipo' when 'sistema' then v_rotina->>'sistema_id' when 'componente' then v_rotina->>'equipamento_id' end)::uuid and ancora=(v_rotina->>'data_base')::date and intervalo_n=(v_rotina->>'intervalo_n')::integer and intervalo_unidade=v_rotina->>'intervalo_unidade';
 select id into v_canonico from pcm.sso_ciclos_calendario_canonicos where serie_id=v_serie and indice=v_ciclo;
 v_data_legado:=pcm.sso_vencimento_ciclo_calendario(v_legado.primeira_data,v_legado.intervalo_n,v_legado.intervalo_unidade,p_indice_legado);
 select * into v_res from pcm.sso_reservas_ciclo_legado r where r.ativa and r.modo='calendario' and r.ciclo_id=v_canonico and r.legado_id=p_legado and r.indice_legado=p_indice_legado and r.plano_id=p_plano and r.cliente_id=p_cliente;
 v_efeitos:=jsonb_build_object('legadaExistente',exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=p_legado and l.indice=p_indice_legado),
  'ssoPreparada',exists(select 1 from pcm.sso_ciclo_calendario_versoes c where c.ciclo_id=v_canonico),
  'ssoPossivelNaoIdentificada',exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.rotina_logica_id=(v_rotina->>'rotina_logica_id')::uuid and o.alvo_tipo=v_rotina->>'alvo_tipo' and o.alvo_id=(case v_rotina->>'alvo_tipo' when 'sistema' then v_rotina->>'sistema_id' when 'componente' then v_rotina->>'equipamento_id' end)::uuid and o.vencimento_original=p_data),
  'reservaExistente',exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo='calendario' and r.ciclo_id=v_canonico) or (r.legado_id=p_legado and r.indice_legado=p_indice_legado))),
  'reservaRevisao',coalesce(v_res.revisao,0),'reservaDecisao',v_res.decisao,
  'reservaConflitante',v_res.id is null and exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo='calendario' and r.ciclo_id=v_canonico) or (r.legado_id=p_legado and r.indice_legado=p_indice_legado))));
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado)||jsonb_build_object(
  'modo','calendario','versaoId',p_versao,'rotinaId',p_rotina,'regraSso',v_rotina,
  'vigenciaInicio',v_versao.vigencia_inicio,'vigenciaFim',v_versao.vigencia_fim,
  'dataReferenciaCivil',v_hoje,'indiceSso',v_ciclo,'dataSso',p_data,'indiceLegado',p_indice_legado,'dataLegado',v_data_legado,'efeitos',v_efeitos);
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 return jsonb_build_object('foto',v_foto,'equivalenciaComprovada',false,'ocorrenciaCriada',false,
  'osCriada',false,'tarefaAuvoCriada',false,'efeitos',v_efeitos);
end; $$;
revoke all on function pcm.sso_prever_reserva_calendario_futuro(uuid,uuid,uuid,uuid,uuid,date,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_decidir_reserva_calendario_futuro(
 p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_data date,
 p_legado uuid,p_indice_legado integer,p_revisao_plano integer,p_revisao_reserva integer,
 p_decisao text,p_confirmado boolean,p_motivo text,p_foto_esperada jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_regra jsonb;v_serie uuid;v_ciclo uuid;v_res pcm.sso_reservas_ciclo_legado%rowtype;
 v_ant pcm.sso_reservas_ciclo_legado%rowtype;v_payload jsonb;v_foto jsonb;v_resultado jsonb;
 v_id uuid;v_motivo text:=nullif(btrim(p_motivo),'');v_legada uuid;
begin
 if p_request is null or p_decisao is null or p_decisao not in ('somente_sso','somente_legado','integrar_ponte')
  or p_revisao_reserva is null or p_revisao_reserva<0 or p_confirmado is distinct from true
  or p_foto_esperada is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'decisao_invalida' using errcode='22023';end if;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,true);
 v_payload:=jsonb_build_object('tipo','reservaFutura','cliente',p_cliente,'plano',p_plano,'versao',p_versao,'rotina',p_rotina,'data',p_data,
  'legado',p_legado,'indiceLegado',p_indice_legado,'revisaoPlano',p_revisao_plano,'revisaoReserva',p_revisao_reserva,
  'decisao',p_decisao,'motivo',v_motivo,'fotoEsperada',p_foto_esperada);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-request:'||p_request::text,0));
 select * into v_ant from pcm.sso_reservas_ciclo_legado where request_id=p_request;
 if found then
  if v_ant.ator_id is distinct from p_ator or v_ant.foto->'payload' is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;
  return jsonb_build_object('requestId',p_request,'reservaId',v_ant.id,'cicloId',v_ant.ciclo_id,'revisao',v_ant.revisao,'decisao',v_ant.decisao,'replay',true);
 end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 perform 1 from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 lock table pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_ciclo_calendario_versoes,pcm.ocorrencias_rotina_preparadas,pcm.sso_chamados_ciclo_preventivo,pcm.sso_ocorrencias_grupo in share mode nowait;
 v_previa:=pcm.sso_prever_reserva_calendario_futuro(p_ator,p_cliente,p_plano,p_versao,p_rotina,p_data,p_legado,p_indice_legado,p_revisao_plano);
 if v_previa->'foto' is distinct from p_foto_esperada then raise exception 'fotografia_obsoleta' using errcode='40001';end if;
 if p_foto_esperada->'relacaoAtual'->>'decisao' is distinct from 'declarar' then raise exception 'relacao_positiva_necessaria' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_legados_nao_relacionados n where n.plano_id=p_plano and n.legado_id=p_legado and n.criado_em >= (select d.criado_em from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano and d.plano_legado_id=p_legado order by d.revisao desc limit 1)) then raise exception 'classificacao_negativa_exige_reconciliacao' using errcode='23514';end if;
 if p_decisao='integrar_ponte' and p_foto_esperada->>'dataSso' is distinct from p_foto_esperada->>'dataLegado' then raise exception 'ponte_datas_incompativeis' using errcode='23514';end if;
 v_regra:=p_foto_esperada->'regraSso';
 insert into pcm.sso_series_ciclo_calendario(plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade)
 values(p_plano,(v_regra->>'rotina_logica_id')::uuid,v_regra->>'alvo_tipo',
  (case v_regra->>'alvo_tipo' when 'sistema' then v_regra->>'sistema_id' when 'componente' then v_regra->>'equipamento_id' end)::uuid,
  (v_regra->>'data_base')::date,(v_regra->>'intervalo_n')::integer,v_regra->>'intervalo_unidade')
 on conflict(plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade) do nothing;
 select id into v_serie from pcm.sso_series_ciclo_calendario where plano_id=p_plano and rotina_logica_id=(v_regra->>'rotina_logica_id')::uuid
  and alvo_tipo=v_regra->>'alvo_tipo' and alvo_id=(case v_regra->>'alvo_tipo' when 'sistema' then v_regra->>'sistema_id' when 'componente' then v_regra->>'equipamento_id' end)::uuid
  and ancora=(v_regra->>'data_base')::date and intervalo_n=(v_regra->>'intervalo_n')::integer and intervalo_unidade=v_regra->>'intervalo_unidade';
 insert into pcm.sso_ciclos_calendario_canonicos(serie_id,indice,vencimento_original) values(v_serie,(p_foto_esperada->>'indiceSso')::integer,p_data) on conflict(serie_id,indice) do nothing;
 select id into v_ciclo from pcm.sso_ciclos_calendario_canonicos where serie_id=v_serie and indice=(p_foto_esperada->>'indiceSso')::integer and vencimento_original=p_data;
 if v_ciclo is null then raise exception 'identidade_divergente' using errcode='23514';end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-ciclo:calendario:'||v_ciclo::text,0)) then raise exception 'ciclo_em_uso' using errcode='55P03';end if;
 if coalesce((v_previa->'efeitos'->>'ssoPossivelNaoIdentificada')::boolean,false) then raise exception 'preparada_existente_exige_reconciliacao' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_ciclo_calendario_versoes where ciclo_id=v_ciclo) then raise exception 'ciclo_ja_preparado_use_fluxo_existente' using errcode='23514';end if;
 select id into v_legada from pcm.ocorrencias_preventivas where plano_id=p_legado and indice=p_indice_legado for update nowait;
 if v_legada is not null and (p_decisao='somente_sso'
  or exists(select 1 from pcm.ocorrencias_preventivas l where l.id=v_legada and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente'))
  or exists(select 1 from pcm.ordens_servico where ocorrencia_preventiva_id=v_legada)) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
 select * into v_res from pcm.sso_reservas_ciclo_legado where legado_id=p_legado and indice_legado=p_indice_legado and ativa for update nowait;
 if found and (v_res.cliente_id is distinct from p_cliente or v_res.plano_id is distinct from p_plano or v_res.modo is distinct from 'calendario' or v_res.ciclo_id is distinct from v_ciclo) then raise exception 'reserva_conflitante' using errcode='23505';end if;
 if coalesce(v_res.revisao,0)<>p_revisao_reserva then raise exception 'reserva_obsoleta' using errcode='40001';end if;
 if v_res.id is not null then update pcm.sso_reservas_ciclo_legado set ativa=false where id=v_res.id;end if;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado);
 insert into pcm.sso_reservas_ciclo_legado(request_id,cliente_id,plano_id,legado_id,indice_legado,modo,ciclo_id,preparada_id,decisao,foto,motivo,revisao,ator_id)
 values(p_request,p_cliente,p_plano,p_legado,p_indice_legado,'calendario',v_ciclo,null,p_decisao,
  v_foto||jsonb_build_object('payload',v_payload,'confirmacao',p_foto_esperada),v_motivo,p_revisao_reserva+1,p_ator) returning id into v_id;
 v_resultado:=jsonb_build_object('requestId',p_request,'reservaId',v_id,'cicloId',v_ciclo,'revisao',p_revisao_reserva+1,'decisao',p_decisao,'replay',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'calendario.reserva_ciclo_futuro','planos_manutencao',p_plano,v_resultado||jsonb_build_object('motivo',v_motivo,'payload',v_payload));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_reserva_calendario_futuro(uuid,uuid,uuid,uuid,uuid,uuid,date,uuid,integer,integer,integer,text,boolean,text,jsonb) from public,anon,authenticated,service_role;

-- A escolha de ponte não autoriza envio/OS legada até que a ponte específica exista.
create function pcm.sso_exigir_ponte_legada_reservada(p_legada uuid) returns void
language plpgsql volatile security definer set search_path='' as $$
declare v_plano uuid;v_indice integer;v_res pcm.sso_reservas_ciclo_legado%rowtype;
begin
 if p_legada is null then return;end if;
 select plano_id,indice into v_plano,v_indice from pcm.ocorrencias_preventivas where id=p_legada for share nowait;
 if not found then return;end if;
 select * into v_res from pcm.sso_reservas_ciclo_legado where legado_id=v_plano and indice_legado=v_indice and ativa for share nowait;
 if not found then return;end if;
 perform 1 from pcm.planos_manutencao where id=v_res.plano_id for share nowait;
 perform 1 from pcm.planos_preventivos where id=v_res.legado_id for share nowait;
 if (v_res.foto-'payload'-'confirmacao') is distinct from pcm.sso_foto_reserva_ciclo(v_res.plano_id,v_res.legado_id) then raise exception 'reserva_obsoleta_exige_reconciliacao' using errcode='23514';end if;
 if v_res.decisao='integrar_ponte' and not (
  (v_res.modo='calendario' and exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.ocorrencias_rotina_vinculos b on b.ocorrencia_preparada_id=c.preparada_id where c.ciclo_id=v_res.ciclo_id and b.ocorrencia_legada_id=p_legada))
  or (v_res.modo='visita' and exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_vinculos_visita_legado b on b.ocorrencia_visita_id=c.preparada_id where c.ciclo_id=v_res.ciclo_id and b.ocorrencia_legada_id=p_legada))
 ) then raise exception 'ponte_reservada_ausente' using errcode='23514';end if;
end; $$;
revoke all on function pcm.sso_exigir_ponte_legada_reservada(uuid) from public,anon,authenticated,service_role;
create function pcm.sso_guardar_envio_ponte_futura() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if new.envio_estado is distinct from old.envio_estado and new.envio_estado<>'prevista'
  or new.auvo_task_id is distinct from old.auvo_task_id then perform pcm.sso_exigir_ponte_legada_reservada(new.id);end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_envio_ponte_futura() from public,anon,authenticated,service_role;
create trigger sso_guardar_envio_ponte_futura before update of envio_estado,auvo_task_id
 on pcm.ocorrencias_preventivas for each row execute function pcm.sso_guardar_envio_ponte_futura();
create function pcm.sso_guardar_os_ponte_futura() returns trigger
language plpgsql volatile security definer set search_path='' as $$
begin
 if new.ocorrencia_preventiva_id is not null then perform pcm.sso_exigir_ponte_legada_reservada(new.ocorrencia_preventiva_id);end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_os_ponte_futura() from public,anon,authenticated,service_role;
create trigger z_sso_guardar_os_ponte_futura before insert or update of ocorrencia_preventiva_id
 on pcm.ordens_servico for each row execute function pcm.sso_guardar_os_ponte_futura();

-- Apenas usuários autenticados alcançam as entradas mediadas; capacidades são revalidadas.
grant execute on function pcm.sso_prever_reserva_calendario_futuro(uuid,uuid,uuid,uuid,uuid,date,uuid,integer,integer) to authenticated;
grant execute on function pcm.sso_decidir_reserva_calendario_futuro(uuid,uuid,uuid,uuid,uuid,uuid,date,uuid,integer,integer,integer,text,boolean,text,jsonb) to authenticated;
