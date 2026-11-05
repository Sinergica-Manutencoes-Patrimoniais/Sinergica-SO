-- ADR-1579: consulta de Visita existente para escolha futura em rascunho.
create function pcm.sso_prever_reserva_visita_rascunho(p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_rotina uuid,p_visita uuid,p_legado uuid,p_indice integer,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p pcm.planos_manutencao%rowtype;rot pcm.rotinas_manutencao%rowtype;vi pcm.visitas%rowtype;orig pcm.visita_origem_contratual%rowtype;reg pcm.regras_visita_contratual%rowtype;leg pcm.planos_preventivos%rowtype;v_data date;v_data_legado date;v_ciclo uuid;v_foto jsonb;v_oper pcm.sso_reservas_ciclo_legado%rowtype;v_rev integer;v_decisao text;v_efeitos jsonb;
begin
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 if p_indice is null or p_indice<0 or p_visita is null or p_revisao is null then raise exception 'candidato_invalido' using errcode='22023';end if;
 lock table pcm.rotinas_manutencao,pcm.visitas,pcm.visita_origem_contratual,pcm.regras_visita_contratual,pcm.sso_visita_regra_transicoes,pcm.feriados_declarados,pcm.sso_visitas_suprimidas_feriado,pcm.visita_ordens_servico,pcm.rotina_visita_serie_vinculos,pcm.rotina_serie_vigencias,pcm.sso_ciclos_visita_canonicos,pcm.sso_ciclo_visita_versoes,pcm.ocorrencias_visita_preparadas,pcm.sso_reservas_ciclo_legado,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_chamados_ciclo_visita,pcm.sso_ocorrencias_grupo,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait;
 select * into p from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found or p.estado not in ('rascunho','em_revisao') or p.revisao is distinct from p_revisao then raise exception 'plano_ou_revisao_indisponivel' using errcode='40001';end if;
 select r.* into rot from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id and v.estado='rascunho' where r.id=p_rotina and r.plano_id=p_plano and r.versao_id=p_rascunho and r.modo='visita';
 if not found then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 select * into vi from pcm.visitas where id=p_visita and cliente_id=p_cliente for share;
 if not found or vi.natureza<>'regular' or vi.estado not in ('rascunho','planejada','confirmada') then raise exception 'visita_indisponivel' using errcode='23514';end if;
 select * into orig from pcm.visita_origem_contratual where visita_id=vi.id and cliente_id=p_cliente;
 if not found then raise exception 'origem_visita_indisponivel' using errcode='23514';end if;
 select * into reg from pcm.regras_visita_contratual where id=pcm.sso_regra_efetiva_visita(vi.id) and serie_id=orig.serie_id;
 if not found or reg.fuso is distinct from vi.fuso or not exists(select 1 from pg_catalog.pg_timezone_names where name=vi.fuso) then raise exception 'regra_indisponivel' using errcode='23514';end if;
 v_data:=orig.semana_origem+(reg.dia_semana-1);
 if (vi.inicio_em at time zone vi.fuso)::date is distinct from v_data or orig.semana_origem<reg.ancora_semana or mod(orig.semana_origem-reg.ancora_semana,7*reg.intervalo_semanas)<>0 or v_data<reg.vigencia_inicio or (reg.vigencia_fim is not null and v_data>reg.vigencia_fim)
 or not exists(select 1 from pcm.rotina_visita_serie_vinculos l join pcm.rotina_serie_vigencias g on g.plano_id=l.plano_id and g.rotina_logica_id=l.rotina_logica_id and g.serie_id=l.serie_id where l.plano_id=p_plano and l.rotina_logica_id=rot.rotina_logica_id and l.serie_id=orig.serie_id and g.inicio<=v_data and (g.fim is null or g.fim>=v_data))
 or exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente and f.ativo and f.data=v_data and (f.contrato_id is null or f.contrato_id=orig.contrato_id))
 or exists(select 1 from pcm.sso_visitas_suprimidas_feriado where visita_id=vi.id) or exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=vi.id and vo.encerrado_em is null) then raise exception 'visita_exige_reconciliacao' using errcode='23514';end if;
 select * into leg from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 if not ((rot.alvo_tipo='sistema' and leg.sistema_id=rot.sistema_id) or (rot.alvo_tipo='componente' and leg.equipamento_id=rot.equipamento_id)) then raise exception 'alvo_incompativel' using errcode='23514';end if;
 select c.id into v_ciclo from pcm.sso_ciclos_visita_canonicos c where c.plano_id=p_plano and c.rotina_logica_id=rot.rotina_logica_id and c.alvo_tipo=rot.alvo_tipo and c.alvo_id=coalesce(rot.sistema_id,rot.equipamento_id,rot.grupo_id) and c.serie_id=orig.serie_id and c.semana_origem=orig.semana_origem;
 v_data_legado:=pcm.sso_vencimento_ciclo_calendario(leg.primeira_data,leg.intervalo_n,leg.intervalo_unidade,p_indice);
 select * into v_oper from pcm.sso_reservas_ciclo_legado where legado_id=p_legado and indice_legado=p_indice and ativa;
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado)||jsonb_build_object('reservaOperacional',case when v_oper.id is not null and v_oper.cliente_id=p_cliente and v_oper.plano_id=p_plano then jsonb_build_object('id',v_oper.id,'modo',v_oper.modo,'cicloId',v_oper.ciclo_id,'revisao',v_oper.revisao,'decisao',v_oper.decisao) else null end,'reservaOperacionalConflitante',v_oper.id is not null and (v_oper.cliente_id is distinct from p_cliente or v_oper.plano_id is distinct from p_plano or v_oper.modo is distinct from 'visita' or v_oper.ciclo_id is distinct from v_ciclo),'modo','visita','rascunhoId',p_rascunho,'regraSso',to_jsonb(rot),'visita',to_jsonb(vi),'origemVisita',to_jsonb(orig),'regraVisita',to_jsonb(reg),'dataSso',v_data,'indiceLegado',p_indice,'dataLegado',v_data_legado,'cicloExistente',v_ciclo,'efeitoSso',exists(select 1 from pcm.sso_chamados_ciclo_visita ch where ch.ciclo_id=v_ciclo) or exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=c.preparada_id where c.ciclo_id=v_ciclo),'identidadeDivergente',exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.rotina_logica_id=rot.rotina_logica_id and o.alvo_tipo=rot.alvo_tipo and o.alvo_id=coalesce(rot.sistema_id,rot.equipamento_id,rot.grupo_id) and o.serie_id=orig.serie_id and o.semana_origem=orig.semana_origem and not exists(select 1 from pcm.sso_ciclo_visita_versoes cv where cv.preparada_id=o.id and cv.ciclo_id=v_ciclo)),'efeitos',jsonb_build_object('efeitoLegado',exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=p_legado and l.indice=p_indice and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente')),'osLegada',exists(select 1 from pcm.ocorrencias_preventivas l join pcm.ordens_servico os on os.ocorrencia_preventiva_id=l.id where l.plano_id=p_legado and l.indice=p_indice),'legadaExistente',exists(select 1 from pcm.ocorrencias_preventivas l where l.plano_id=p_legado and l.indice=p_indice),'ssoPreparada',exists(select 1 from pcm.sso_ciclo_visita_versoes c where c.ciclo_id=v_ciclo),'ssoPossivelNaoIdentificada',exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.rotina_logica_id=rot.rotina_logica_id and o.alvo_tipo=rot.alvo_tipo and o.alvo_id=coalesce(rot.sistema_id,rot.equipamento_id,rot.grupo_id) and o.serie_id=orig.serie_id and o.semana_origem=orig.semana_origem),'reservaExistente',exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo='visita' and r.ciclo_id=v_ciclo) or (r.legado_id=p_legado and r.indice_legado=p_indice)))));
 select revisao_escolha,decisao into v_rev,v_decisao from pcm.sso_escolhas_reserva_futura_rascunho where plano_id=p_plano and rascunho_id=p_rascunho and modo='visita' and rotina_id=p_rotina and data_sso=v_data order by revisao_escolha desc limit 1;
 v_efeitos:=(v_foto->'efeitos')||jsonb_build_object('reservaConflitante',coalesce((v_foto->>'reservaOperacionalConflitante')::boolean,true),'reservaRevisao',coalesce(v_rev,0),'reservaDecisao',v_decisao);
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 return jsonb_build_object('efeitos',v_efeitos,'foto',v_foto,'equivalenciaComprovada',false,'fontesFeriadosCompletas',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false,'rascunhoNaoAprovado',true);
end; $$;
revoke all on function pcm.sso_prever_reserva_visita_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create table pcm.sso_escolhas_reserva_visita_detalhes(request_id uuid primary key references pcm.sso_escolhas_reserva_futura_rascunho(request_id),visita_id uuid not null references pcm.visitas(id),serie_id uuid not null,semana_origem date not null);
alter table pcm.sso_escolhas_reserva_visita_detalhes enable row level security;
alter table pcm.sso_escolhas_reserva_visita_detalhes force row level security;
revoke all on pcm.sso_escolhas_reserva_visita_detalhes from public,anon,authenticated,service_role;
create trigger sso_escolhas_reserva_visita_detalhes_imutavel before update or delete on pcm.sso_escolhas_reserva_visita_detalhes for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_decidir_reserva_visita_rascunho(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_rotina uuid,p_visita uuid,p_legado uuid,p_indice integer,p_revisao_plano integer,p_revisao_escolha integer,p_decisao text,p_confirmado boolean,p_motivo text,p_foto_esperada jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_previa jsonb;v_ant pcm.sso_escolhas_reserva_futura_rascunho%rowtype;v_payload jsonb;v_resultado jsonb;v_rev integer;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if p_request is null or p_revisao_escolha is null or p_revisao_escolha<0 or p_decisao not in ('somente_sso','somente_legado','integrar_ponte') or p_decisao is null or p_confirmado is distinct from true or p_foto_esperada is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'decisao_invalida' using errcode='22023';end if;
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,true);
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'rascunho',p_rascunho,'rotina',p_rotina,'visita',p_visita,'legado',p_legado,'indice',p_indice,'revisaoPlano',p_revisao_plano,'revisaoEscolha',p_revisao_escolha,'decisao',p_decisao,'motivo',v_motivo,'fotoEsperada',p_foto_esperada);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-rascunho-request:'||p_request::text,0));
 select * into v_ant from pcm.sso_escolhas_reserva_futura_rascunho where request_id=p_request;
 if found then if v_ant.ator_id is distinct from p_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente and revisao=p_revisao_plano for update nowait;if not found then raise exception 'plano_ou_revisao_indisponivel' using errcode='40001';end if;
 perform 1 from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for share nowait;if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 v_previa:=pcm.sso_prever_reserva_visita_rascunho(p_ator,p_cliente,p_plano,p_rascunho,p_rotina,p_visita,p_legado,p_indice,p_revisao_plano);
 if v_previa->'foto' is distinct from p_foto_esperada then raise exception 'fotografia_obsoleta' using errcode='40001';end if;
 if p_foto_esperada->'relacaoAtual'->>'decisao' is distinct from 'declarar' then raise exception 'relacao_positiva_necessaria' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_legados_nao_relacionados n where n.plano_id=p_plano and n.legado_id=p_legado and n.criado_em >= (select d.criado_em from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano and d.plano_legado_id=p_legado order by d.revisao desc limit 1)) then raise exception 'classificacao_negativa_exige_reconciliacao' using errcode='23514';end if;
 if coalesce((p_foto_esperada->>'reservaOperacionalConflitante')::boolean,true) or ((p_foto_esperada->'reservaOperacional')='null'::jsonb and coalesce((p_foto_esperada->'efeitos'->>'ssoPossivelNaoIdentificada')::boolean,false)) or coalesce((p_foto_esperada->>'efeitoSso')::boolean,false) or coalesce((p_foto_esperada->>'identidadeDivergente')::boolean,true) then raise exception 'origem_existente_exige_reconciliacao' using errcode='23514';end if;
 if coalesce((p_foto_esperada->'efeitos'->>'efeitoLegado')::boolean,false) or coalesce((p_foto_esperada->'efeitos'->>'osLegada')::boolean,false) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
 if p_decisao='somente_sso' and coalesce((p_foto_esperada->'efeitos'->>'legadaExistente')::boolean,false) then raise exception 'legada_existente_exige_reconciliacao' using errcode='23514';end if;
 if p_decisao='integrar_ponte' and p_foto_esperada->>'dataSso' is distinct from p_foto_esperada->>'dataLegado' then raise exception 'ponte_datas_incompativeis' using errcode='23514';end if;
 select coalesce(max(revisao_escolha),0) into v_rev from pcm.sso_escolhas_reserva_futura_rascunho where plano_id=p_plano and rascunho_id=p_rascunho and modo='visita' and rotina_id=p_rotina and data_sso=(p_foto_esperada->>'dataSso')::date;
 if v_rev<>p_revisao_escolha then raise exception 'escolha_obsoleta' using errcode='40001';end if;
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 v_resultado:=jsonb_build_object('requestId',p_request,'revisao',v_rev+1,'decisao',p_decisao,'rascunhoNaoAprovado',true,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_escolhas_reserva_futura_rascunho(request_id,cliente_id,plano_id,rascunho_id,rotina_id,modo,legado_id,indice_legado,data_sso,indice_sso,decisao,revisao_plano,revisao_escolha,ator_id,foto,payload,resultado)
 values(p_request,p_cliente,p_plano,p_rascunho,p_rotina,'visita',p_legado,p_indice,(p_foto_esperada->>'dataSso')::date,null,p_decisao,p_revisao_plano,v_rev+1,p_ator,p_foto_esperada,v_payload,v_resultado);
 insert into pcm.sso_escolhas_reserva_visita_detalhes values(p_request,p_visita,(p_foto_esperada->'origemVisita'->>'serie_id')::uuid,(p_foto_esperada->'origemVisita'->>'semana_origem')::date);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'visita.escolha_reserva_rascunho','planos_manutencao',p_plano,v_resultado||jsonb_build_object('motivo',v_motivo,'payload',v_payload));return v_resultado;
end; $$;
revoke all on function pcm.sso_decidir_reserva_visita_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text,jsonb) from public,anon,authenticated,service_role;

-- Selo de Visita revalida a última escolha antes de aprovar; não produz reserva ativa.
create function pcm.sso_selar_reserva_visita_rascunho() returns trigger language plpgsql volatile security definer set search_path='' as $$
declare p pcm.planos_manutencao%rowtype;v_previa jsonb;v_rascunho uuid;e record;v_atual jsonb;v_rot jsonb;v_orig jsonb;v_ciclo uuid;v_anterior uuid;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;if not found then return new;end if;
 select * into p from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null then raise exception 'sem_acesso' using errcode='42501';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,p.revisao,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_rascunho is null or (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514';end if;
 if not exists(select 1 from pcm.sso_escolhas_reserva_futura_rascunho x where x.cliente_id=p.cliente_id and x.plano_id=p.id and x.rascunho_id=v_rascunho and x.modo='visita') then return new;end if;
 perform pcm.sso_exigir_visita_ponte(auth.uid(),p.cliente_id,true);
 for e in select distinct on (x.rotina_id,x.data_sso) x.*,d.visita_id from pcm.sso_escolhas_reserva_futura_rascunho x join pcm.sso_escolhas_reserva_visita_detalhes d on d.request_id=x.request_id where x.cliente_id=p.cliente_id and x.plano_id=p.id and x.rascunho_id=v_rascunho and x.modo='visita' order by x.rotina_id,x.data_sso,x.revisao_escolha desc loop
  if e.revisao_plano is distinct from p.revisao or e.data_sso<new.vigencia_inicio or (e.foto->>'dataLegado')::date<new.vigencia_inicio then raise exception 'escolha_visita_obsoleta_ou_antes_vigencia' using errcode='23514';end if;
  v_atual:=pcm.sso_prever_reserva_visita_rascunho(auth.uid(),e.cliente_id,e.plano_id,e.rascunho_id,e.rotina_id,e.visita_id,e.legado_id,e.indice_legado,e.revisao_plano);
  if v_atual->'foto' is distinct from e.foto or coalesce((v_atual->'foto'->>'reservaOperacionalConflitante')::boolean,true) or coalesce((v_atual->'foto'->>'efeitoSso')::boolean,false) or coalesce((v_atual->'foto'->>'identidadeDivergente')::boolean,true) or coalesce((v_atual->'foto'->'efeitos'->>'efeitoLegado')::boolean,false) or coalesce((v_atual->'foto'->'efeitos'->>'osLegada')::boolean,false) then raise exception 'escolha_visita_exige_reconciliacao' using errcode='23514';end if;
  v_rot:=e.foto->'regraSso';v_orig:=e.foto->'origemVisita';
  insert into pcm.sso_ciclos_visita_canonicos(plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem) values(e.plano_id,(v_rot->>'rotina_logica_id')::uuid,v_rot->>'alvo_tipo',(case v_rot->>'alvo_tipo' when 'sistema' then v_rot->>'sistema_id' when 'componente' then v_rot->>'equipamento_id' end)::uuid,(v_orig->>'serie_id')::uuid,(v_orig->>'semana_origem')::date) on conflict(plano_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem) do nothing;
  select id into v_ciclo from pcm.sso_ciclos_visita_canonicos where plano_id=e.plano_id and rotina_logica_id=(v_rot->>'rotina_logica_id')::uuid and alvo_tipo=v_rot->>'alvo_tipo' and alvo_id=(case v_rot->>'alvo_tipo' when 'sistema' then v_rot->>'sistema_id' when 'componente' then v_rot->>'equipamento_id' end)::uuid and serie_id=(v_orig->>'serie_id')::uuid and semana_origem=(v_orig->>'semana_origem')::date;
  if v_ciclo is null then raise exception 'identidade_divergente' using errcode='23514';end if;
  v_anterior:=nullif(v_atual->'foto'->'reservaOperacional'->>'id','')::uuid;
  if coalesce((v_atual->'foto'->'efeitos'->>'ssoPossivelNaoIdentificada')::boolean,false) and v_anterior is null then raise exception 'preparada_existente_exige_reconciliacao' using errcode='23514';end if;
  if v_anterior is not null and not exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.id=v_anterior and r.ativa and r.cliente_id=e.cliente_id and r.plano_id=e.plano_id and r.legado_id=e.legado_id and r.indice_legado=e.indice_legado and r.modo='visita' and r.ciclo_id=v_ciclo) then raise exception 'reserva_exige_reconciliacao' using errcode='23514';end if;
  perform 1 from pcm.planos_preventivos where id=e.legado_id and cliente_id=e.cliente_id for update nowait;if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-ciclo:visita:'||v_ciclo::text,0)) then raise exception 'ciclo_em_uso' using errcode='55P03';end if;
  if exists(select 1 from pcm.sso_selos_reserva_futura_rascunho s join pcm.sso_escolhas_reserva_futura_rascunho x on x.request_id=s.escolha_request_id join pcm.plano_versoes ov on ov.id=s.versao_id and ov.estado='aprovado' and ov.vigencia_inicio<=x.data_sso and (ov.vigencia_fim is null or ov.vigencia_fim>=x.data_sso) where ((s.modo='visita' and s.ciclo_id=v_ciclo) or (x.legado_id=e.legado_id and x.indice_legado=e.indice_legado)) and not (x.plano_id=e.plano_id and s.versao_id=new.versao_anterior_id and x.data_sso>=new.vigencia_inicio)) then raise exception 'selo_reserva_conflitante' using errcode='23505';end if;
  insert into pcm.sso_selos_reserva_futura_rascunho(escolha_request_id,versao_id,vigencia,modo,ciclo_id,reserva_anterior_id) values(e.request_id,v_rascunho,new.vigencia_inicio,'visita',v_ciclo,v_anterior);
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_selar_reserva_visita_rascunho() from public,anon,authenticated,service_role;
create trigger sso_selar_reserva_visita_rascunho after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_selar_reserva_visita_rascunho();

-- Consulta mediada: função histórica permanece privada.
create function pcm.sso_listar_series_reserva_visita(p_ator uuid,p_cliente uuid,p_plano uuid,p_rotina uuid,p_apos uuid,p_limite integer)
returns table(serie_id uuid,criado_em timestamptz) language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 if not exists(select 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente) then raise exception 'sem_acesso' using errcode='42501';end if;
 return query select * from pcm.sso_listar_vinculos_rotina_serie(p_plano,p_rotina,p_apos,p_limite);
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
end; $$;
revoke all on function pcm.sso_listar_series_reserva_visita(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_listar_visitas_reserva_rascunho(p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_rotina uuid,p_serie uuid,p_inicio date,p_fim date,p_apos uuid,p_limite integer)
returns table(visita_id uuid,semana_origem date,vencimento_original date,estado_visita text,feriado_declarado boolean,vigencia_declarada boolean,ocorrencia_preparada boolean)
language plpgsql volatile security definer set search_path='' as $$
declare v_logica uuid;
begin
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
 if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366 or p_limite is null or p_limite not between 1 and 50 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select r.rotina_logica_id into v_logica from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id and v.estado='rascunho' join pcm.planos_manutencao p on p.id=r.plano_id and p.cliente_id=p_cliente where r.id=p_rotina and r.plano_id=p_plano and r.versao_id=p_rascunho and r.modo='visita';
 if v_logica is null or not exists(select 1 from pcm.rotina_visita_serie_vinculos l join pcm.calendario_contratual_series s on s.id=l.serie_id and s.cliente_id=p_cliente where l.plano_id=p_plano and l.rotina_logica_id=v_logica and l.serie_id=p_serie) then raise exception 'serie_indisponivel' using errcode='23514';end if;
 return query select v.id,o.semana_origem,o.semana_origem+(r.dia_semana-1),v.estado,
  exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente and f.ativo and f.data=o.semana_origem+(r.dia_semana-1) and (f.contrato_id is null or f.contrato_id=o.contrato_id)),
  exists(select 1 from pcm.rotina_serie_vigencias g where g.plano_id=p_plano and g.rotina_logica_id=v_logica and g.serie_id=p_serie and g.inicio<=o.semana_origem+(r.dia_semana-1) and (g.fim is null or g.fim>=o.semana_origem+(r.dia_semana-1))),
  exists(select 1 from pcm.ocorrencias_visita_preparadas x where x.plano_id=p_plano and x.rotina_logica_id=v_logica and x.serie_id=p_serie and x.semana_origem=o.semana_origem)
 from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id join pcm.regras_visita_contratual r on r.id=pcm.sso_regra_efetiva_visita(v.id) and r.serie_id=o.serie_id
 where o.cliente_id=p_cliente and o.serie_id=p_serie and v.natureza='regular' and v.estado in ('rascunho','planejada','confirmada') and o.semana_origem+(r.dia_semana-1) between p_inicio and p_fim and (p_apos is null or v.id>p_apos) order by v.id limit p_limite;
 perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);
end; $$;
revoke all on function pcm.sso_listar_visitas_reserva_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,date,date,uuid,integer) from public,anon,authenticated,service_role;

grant execute on function pcm.sso_prever_reserva_visita_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer) to authenticated;
grant execute on function pcm.sso_decidir_reserva_visita_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,integer,text,boolean,text,jsonb) to authenticated;
grant execute on function pcm.sso_listar_series_reserva_visita(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
grant execute on function pcm.sso_listar_visitas_reserva_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,date,date,uuid,integer) to authenticated;
