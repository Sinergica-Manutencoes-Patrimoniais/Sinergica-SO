-- ADR-1578: escolha em rascunho e selo não criam ocorrência nem tarefa.
create table pcm.sso_escolhas_reserva_futura_rascunho (
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 rascunho_id uuid not null references pcm.plano_versoes(id),rotina_id uuid not null references pcm.rotinas_manutencao(id),
 modo text not null check(modo in ('calendario','visita')),legado_id uuid not null references pcm.planos_preventivos(id),
 indice_legado integer not null check(indice_legado>=0),data_sso date not null,indice_sso integer,
 decisao text not null check(decisao in ('somente_sso','somente_legado','integrar_ponte')),
 revisao_plano integer not null,revisao_escolha integer not null,ator_id uuid not null references auth.users(id),
 foto jsonb not null,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default clock_timestamp(),
 check((modo='calendario' and indice_sso is not null and indice_sso>=0) or modo='visita')
);
create index sso_escolhas_reserva_rascunho_busca on pcm.sso_escolhas_reserva_futura_rascunho(plano_id,rascunho_id,modo,rotina_id,data_sso,revisao_escolha desc);
alter table pcm.sso_escolhas_reserva_futura_rascunho enable row level security;
alter table pcm.sso_escolhas_reserva_futura_rascunho force row level security;
revoke all on pcm.sso_escolhas_reserva_futura_rascunho from public,anon,authenticated,service_role;
create trigger sso_escolhas_reserva_rascunho_imutavel before update or delete on pcm.sso_escolhas_reserva_futura_rascunho for each row execute function pcm.sso_proteger_conferencia_levantamento();
create table pcm.sso_selos_reserva_futura_rascunho (
 escolha_request_id uuid primary key references pcm.sso_escolhas_reserva_futura_rascunho(request_id),
 versao_id uuid not null references pcm.plano_versoes(id),vigencia date not null,
 modo text not null check(modo in ('calendario','visita')),ciclo_id uuid not null,
 reserva_anterior_id uuid references pcm.sso_reservas_ciclo_legado(id),
 criado_em timestamptz not null default clock_timestamp()
);
alter table pcm.sso_selos_reserva_futura_rascunho enable row level security;
alter table pcm.sso_selos_reserva_futura_rascunho force row level security;
revoke all on pcm.sso_selos_reserva_futura_rascunho from public,anon,authenticated,service_role;
create trigger sso_selos_reserva_rascunho_imutavel before update or delete on pcm.sso_selos_reserva_futura_rascunho for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Prévia de uma Rotina do rascunho e um índice legado, sem escrever nas fontes.
create function pcm.sso_prever_reserva_calendario_rascunho(
 p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_rotina uuid,p_indice_sso integer,
 p_legado uuid,p_indice_legado integer,p_revisao_plano integer
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare p pcm.planos_manutencao%rowtype;v pcm.plano_versoes%rowtype;r pcm.rotinas_manutencao%rowtype;
 l pcm.planos_preventivos%rowtype;v_versao_anterior uuid;v_hoje date;v_data date;v_data_legado date;v_foto jsonb;v_regra jsonb;v_atual record;v_reserva pcm.sso_reservas_ciclo_legado%rowtype;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 if p_indice_sso is null or p_indice_sso<0 or p_indice_sso>3660000 or p_indice_legado is null or p_indice_legado<0 then raise exception 'indice_invalido' using errcode='22023';end if;
 select * into p from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found or p.estado not in ('rascunho','em_revisao') or p.revisao is distinct from p_revisao_plano then raise exception 'plano_ou_revisao_indisponivel' using errcode='40001';end if;
 select * into v from pcm.plano_versoes where id=p_rascunho and plano_id=p_plano and estado='rascunho' for share nowait;
 if not found then raise exception 'rascunho_indisponivel' using errcode='23514';end if;
 select * into r from pcm.rotinas_manutencao where id=p_rotina and plano_id=p_plano and versao_id=p_rascunho and modo='calendario' for share nowait;
 if not found then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 select id into v_versao_anterior from pcm.plano_versoes where plano_id=p_plano and estado='aprovado' order by numero desc limit 1;
 if v_versao_anterior is null then raise exception 'versao_anterior_indisponivel' using errcode='23514';end if;
 v_hoje:=pcm.sso_data_civil_versao_geracao(p_plano,v_versao_anterior);
 v_data:=pcm.sso_vencimento_ciclo_calendario(r.data_base,r.intervalo_n,r.intervalo_unidade,p_indice_sso);
 if v_data<=v_hoje or v_data>v_hoje+730 then raise exception 'candidato_fora_da_janela' using errcode='22023';end if;
 select * into l from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 if not ((r.alvo_tipo='sistema' and r.sistema_id=l.sistema_id) or (r.alvo_tipo='componente' and r.equipamento_id=l.equipamento_id)) then raise exception 'alvo_incompativel' using errcode='23514';end if;
 v_data_legado:=pcm.sso_vencimento_ciclo_calendario(l.primeira_data,l.intervalo_n,l.intervalo_unidade,p_indice_legado);
 v_regra:=jsonb_build_object('id',r.id,'rotina_logica_id',r.rotina_logica_id,'modo',r.modo,'alvo_tipo',r.alvo_tipo,'sistema_id',r.sistema_id,'equipamento_id',r.equipamento_id,'grupo_id',r.grupo_id,'data_base',r.data_base,'intervalo_n',r.intervalo_n,'intervalo_unidade',r.intervalo_unidade,'questionario_id',r.questionario_id);
 select request_id,revisao_escolha,decisao into v_atual from pcm.sso_escolhas_reserva_futura_rascunho where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and modo='calendario' and rotina_id=p_rotina and data_sso=v_data and legado_id=p_legado and indice_legado=p_indice_legado order by revisao_escolha desc limit 1;
 select * into v_reserva from pcm.sso_reservas_ciclo_legado where legado_id=p_legado and indice_legado=p_indice_legado and ativa;
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,p_legado)||jsonb_build_object('modo','calendario','rascunhoId',p_rascunho,'regraSso',v_regra,'indiceSso',p_indice_sso,'dataSso',v_data,'indiceLegado',p_indice_legado,'dataLegado',v_data_legado,'dataReferenciaCivil',v_hoje,'reservaOperacional',case when v_reserva.id is not null and v_reserva.cliente_id=p_cliente and v_reserva.plano_id=p_plano then jsonb_build_object('id',v_reserva.id,'modo',v_reserva.modo,'cicloId',v_reserva.ciclo_id,'revisao',v_reserva.revisao,'decisao',v_reserva.decisao) else null end,'reservaOperacionalConflitante',v_reserva.id is not null and (v_reserva.cliente_id is distinct from p_cliente or v_reserva.plano_id is distinct from p_plano),'escolhaRevisao',coalesce(v_atual.revisao_escolha,0),'escolhaDecisao',v_atual.decisao,
  'legadaExistente',exists(select 1 from pcm.ocorrencias_preventivas where plano_id=p_legado and indice=p_indice_legado),
  'efeitoLegado',exists(select 1 from pcm.ocorrencias_preventivas op where op.plano_id=p_legado and op.indice=p_indice_legado and (op.envio_estado<>'prevista' or op.auvo_task_id is not null or op.resultado_estado<>'pendente' or exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=op.id))),
  'efeitoSso',case when v_reserva.cliente_id=p_cliente and v_reserva.plano_id=p_plano and v_reserva.modo='calendario' then exists(select 1 from pcm.sso_chamados_ciclo_preventivo ch where ch.ciclo_id=v_reserva.ciclo_id) or exists(select 1 from pcm.sso_ciclo_calendario_versoes cv join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=cv.preparada_id where cv.ciclo_id=v_reserva.ciclo_id) or exists(select 1 from pcm.sso_ciclo_calendario_versoes cv join pcm.os_rotina_vinculos_explicitos x on x.ocorrencia_preparada_id=cv.preparada_id where cv.ciclo_id=v_reserva.ciclo_id) else false end,
  'ssoPossivelPreparada',exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.rotina_logica_id=r.rotina_logica_id and o.alvo_tipo=r.alvo_tipo and o.alvo_id=coalesce(r.sistema_id,r.equipamento_id,r.grupo_id) and o.vencimento_original=v_data));
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 return jsonb_build_object('foto',v_foto,'equivalenciaComprovada',false,'efeitoOperacional',false);
end; $$;
revoke all on function pcm.sso_prever_reserva_calendario_rascunho(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_escolher_reserva_calendario_rascunho(
 p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_rotina uuid,p_indice_sso integer,
 p_legado uuid,p_indice_legado integer,p_revisao_plano integer,p_revisao_escolha integer,
 p_decisao text,p_confirmado boolean,p_motivo text,p_foto_esperada jsonb
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_escolhas_reserva_futura_rascunho%rowtype;v_foto jsonb;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');v_data date;v_existente uuid;
begin
 if p_request is null or p_decisao is null or p_decisao not in ('somente_sso','somente_legado','integrar_ponte') or p_revisao_escolha is null or p_revisao_escolha<0 or p_confirmado is distinct from true or p_foto_esperada is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'decisao_invalida' using errcode='22023';end if;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,true);
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'rascunho',p_rascunho,'rotina',p_rotina,'indiceSso',p_indice_sso,'legado',p_legado,'indiceLegado',p_indice_legado,'revisaoPlano',p_revisao_plano,'revisaoEscolha',p_revisao_escolha,'decisao',p_decisao,'motivo',v_motivo,'fotoEsperada',p_foto_esperada);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-rascunho-request:'||p_request::text,0));
 select * into v_ant from pcm.sso_escolhas_reserva_futura_rascunho where request_id=p_request;
 if found then if v_ant.ator_id is distinct from p_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 perform 1 from pcm.planos_preventivos where id=p_legado and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'legado_indisponivel' using errcode='42501';end if;
 lock table pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.ocorrencias_rotina_preparadas,pcm.sso_reservas_ciclo_legado,pcm.sso_chamados_ciclo_preventivo,pcm.sso_ocorrencias_grupo,pcm.os_rotina_vinculos_explicitos in share mode nowait;
 v_foto:=pcm.sso_prever_reserva_calendario_rascunho(p_ator,p_cliente,p_plano,p_rascunho,p_rotina,p_indice_sso,p_legado,p_indice_legado,p_revisao_plano)->'foto';
 if v_foto is distinct from p_foto_esperada then raise exception 'fotografia_obsoleta' using errcode='40001';end if;
 if v_foto->'relacaoAtual'->>'decisao' is distinct from 'declarar' then raise exception 'relacao_positiva_necessaria' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_legados_nao_relacionados n where n.plano_id=p_plano and n.legado_id=p_legado and n.criado_em >= (select d.criado_em from pcm.sso_declaracoes_planos_legados d where d.plano_id=p_plano and d.plano_legado_id=p_legado order by d.revisao desc limit 1)) then raise exception 'classificacao_negativa_exige_reconciliacao' using errcode='23514';end if;
 if (v_foto->>'escolhaRevisao')::integer is distinct from p_revisao_escolha then raise exception 'escolha_obsoleta' using errcode='40001';end if;
 v_data:=(v_foto->>'dataSso')::date;
 if (v_foto->>'efeitoLegado')::boolean or (v_foto->>'efeitoSso')::boolean then raise exception 'efeito_exige_reconciliacao' using errcode='23514';end if;
 if (v_foto->>'reservaOperacionalConflitante')::boolean then raise exception 'reserva_existente_exige_reconciliacao' using errcode='23514';end if;
 if (v_foto->>'ssoPossivelPreparada')::boolean and v_foto->'reservaOperacional'='null'::jsonb then raise exception 'preparada_existente_exige_reconciliacao' using errcode='23514';end if;
 if p_decisao='integrar_ponte' and v_foto->>'dataSso' is distinct from v_foto->>'dataLegado' then raise exception 'ponte_datas_incompativeis' using errcode='23514';end if;
 select id into v_existente from pcm.ocorrencias_preventivas where plano_id=p_legado and indice=p_indice_legado for update nowait;
 if v_existente is not null and (p_decisao='somente_sso' or exists(select 1 from pcm.ocorrencias_preventivas l where l.id=v_existente and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente')) or exists(select 1 from pcm.ordens_servico where ocorrencia_preventiva_id=v_existente)) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_escolhas_reserva_futura_rascunho e where e.plano_id=p_plano and e.rascunho_id=p_rascunho and e.revisao_plano=p_revisao_plano and ((e.legado_id=p_legado and e.indice_legado=p_indice_legado) or (e.modo='calendario' and e.rotina_id=p_rotina and e.data_sso=v_data)) and not (e.modo='calendario' and e.rotina_id=p_rotina and e.data_sso=v_data and e.legado_id=p_legado and e.indice_legado=p_indice_legado)) then raise exception 'candidato_em_outra_escolha' using errcode='23505';end if;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 v_resultado:=jsonb_build_object('requestId',p_request,'revisao',p_revisao_escolha+1,'decisao',p_decisao,'selada',false,'efeitoOperacional',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_escolhas_reserva_futura_rascunho(request_id,cliente_id,plano_id,rascunho_id,rotina_id,modo,legado_id,indice_legado,data_sso,indice_sso,decisao,revisao_plano,revisao_escolha,ator_id,foto,payload,resultado)
 values(p_request,p_cliente,p_plano,p_rascunho,p_rotina,'calendario',p_legado,p_indice_legado,v_data,p_indice_sso,p_decisao,p_revisao_plano,p_revisao_escolha+1,p_ator,v_foto,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'plano.escolha_reserva_futura_rascunho','planos_manutencao',p_plano,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_escolher_reserva_calendario_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,integer,integer,text,boolean,text,jsonb) from public,anon,authenticated,service_role;

-- Sela somente a última escolha por par na mesma transação da aprovação.
create function pcm.sso_selar_reserva_calendario_rascunho() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_previa jsonb;v_rascunho uuid;v_item record;v_atual jsonb;v_regra jsonb;v_serie uuid;v_ciclo uuid;v_legada uuid;v_anterior uuid;
begin
 if not exists(select 1 from pcm.sso_escolhas_reserva_futura_rascunho e join pcm.plano_versoes v on v.id=e.rascunho_id and v.estado='rascunho' where e.plano_id=new.plano_id and e.modo='calendario') then return new;end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_rascunho is null or (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514';end if;
 for v_item in select distinct on (e.rotina_id,e.data_sso,e.legado_id,e.indice_legado) e.* from pcm.sso_escolhas_reserva_futura_rascunho e
  where e.cliente_id=v_plano.cliente_id and e.plano_id=new.plano_id and e.rascunho_id=v_rascunho and e.modo='calendario'
  order by e.rotina_id,e.data_sso,e.legado_id,e.indice_legado,e.revisao_escolha desc loop
  if v_item.revisao_plano is distinct from v_plano.revisao then raise exception 'escolha_reserva_obsoleta' using errcode='40001';end if;
  if v_item.data_sso<new.vigencia_inicio or (v_item.foto->>'dataLegado')::date<new.vigencia_inicio then raise exception 'reserva_anterior_vigencia' using errcode='23514';end if;
  perform 1 from pcm.planos_preventivos where id=v_item.legado_id and cliente_id=v_item.cliente_id for update nowait;
  if not found then raise exception 'legado_indisponivel' using errcode='23514';end if;
  lock table pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.ocorrencias_rotina_preparadas,pcm.sso_reservas_ciclo_legado,pcm.sso_chamados_ciclo_preventivo,pcm.sso_ocorrencias_grupo,pcm.os_rotina_vinculos_explicitos in share mode nowait;
  v_atual:=pcm.sso_prever_reserva_calendario_rascunho(auth.uid(),v_item.cliente_id,v_item.plano_id,v_item.rascunho_id,v_item.rotina_id,v_item.indice_sso,v_item.legado_id,v_item.indice_legado,v_item.revisao_plano)->'foto';
  if (v_atual-'escolhaRevisao'-'escolhaDecisao') is distinct from (v_item.foto-'escolhaRevisao'-'escolhaDecisao') or (v_atual->>'escolhaRevisao')::integer is distinct from v_item.revisao_escolha or v_atual->>'escolhaDecisao' is distinct from v_item.decisao then raise exception 'fotografia_reserva_obsoleta' using errcode='40001';end if;
  if (v_atual->>'reservaOperacionalConflitante')::boolean then raise exception 'reserva_exige_reconciliacao' using errcode='23514';end if;
  v_anterior:=nullif(v_atual->'reservaOperacional'->>'id','')::uuid;
  if (v_atual->>'ssoPossivelPreparada')::boolean and v_anterior is null then raise exception 'preparada_existente_exige_reconciliacao' using errcode='23514';end if;
  select id into v_legada from pcm.ocorrencias_preventivas where plano_id=v_item.legado_id and indice=v_item.indice_legado for update nowait;
  if v_legada is not null and (v_item.decisao='somente_sso' or exists(select 1 from pcm.ocorrencias_preventivas l where l.id=v_legada and (l.envio_estado<>'prevista' or l.auvo_task_id is not null or l.resultado_estado<>'pendente')) or exists(select 1 from pcm.ordens_servico where ocorrencia_preventiva_id=v_legada)) then raise exception 'efeito_legado_exige_reconciliacao' using errcode='23514';end if;
  v_regra:=v_item.foto->'regraSso';
  insert into pcm.sso_series_ciclo_calendario(plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade) values(v_item.plano_id,(v_regra->>'rotina_logica_id')::uuid,v_regra->>'alvo_tipo',(case v_regra->>'alvo_tipo' when 'sistema' then v_regra->>'sistema_id' when 'componente' then v_regra->>'equipamento_id' end)::uuid,(v_regra->>'data_base')::date,(v_regra->>'intervalo_n')::integer,v_regra->>'intervalo_unidade') on conflict(plano_id,rotina_logica_id,alvo_tipo,alvo_id,ancora,intervalo_n,intervalo_unidade) do nothing;
  select id into v_serie from pcm.sso_series_ciclo_calendario where plano_id=v_item.plano_id and rotina_logica_id=(v_regra->>'rotina_logica_id')::uuid and alvo_tipo=v_regra->>'alvo_tipo' and alvo_id=(case v_regra->>'alvo_tipo' when 'sistema' then v_regra->>'sistema_id' when 'componente' then v_regra->>'equipamento_id' end)::uuid and ancora=(v_regra->>'data_base')::date and intervalo_n=(v_regra->>'intervalo_n')::integer and intervalo_unidade=v_regra->>'intervalo_unidade';
  insert into pcm.sso_ciclos_calendario_canonicos(serie_id,indice,vencimento_original) values(v_serie,v_item.indice_sso,v_item.data_sso) on conflict(serie_id,indice) do nothing;
  select id into v_ciclo from pcm.sso_ciclos_calendario_canonicos where serie_id=v_serie and indice=v_item.indice_sso and vencimento_original=v_item.data_sso;
  if v_ciclo is null then raise exception 'identidade_divergente' using errcode='23514';end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-reserva-ciclo:calendario:'||v_ciclo::text,0)) then raise exception 'ciclo_em_uso' using errcode='55P03';end if;
  if v_anterior is not null and not exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.id=v_anterior and r.ativa and r.cliente_id=v_item.cliente_id and r.plano_id=v_item.plano_id and r.legado_id=v_item.legado_id and r.indice_legado=v_item.indice_legado and r.modo='calendario' and r.ciclo_id=v_ciclo) then raise exception 'reserva_existente_exige_reconciliacao' using errcode='23514';end if;
  if exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.rotina_logica_id=(v_regra->>'rotina_logica_id')::uuid and o.alvo_tipo=v_regra->>'alvo_tipo' and o.alvo_id=(case v_regra->>'alvo_tipo' when 'sistema' then v_regra->>'sistema_id' when 'componente' then v_regra->>'equipamento_id' end)::uuid and o.vencimento_original=v_item.data_sso and not exists(select 1 from pcm.sso_ciclo_calendario_versoes c where c.preparada_id=o.id and c.ciclo_id=v_ciclo)) then raise exception 'preparada_existente_exige_reconciliacao' using errcode='23514';end if;
  if exists(select 1 from pcm.sso_chamados_ciclo_preventivo where ciclo_id=v_ciclo) or exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=c.preparada_id where c.ciclo_id=v_ciclo) or exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.os_rotina_vinculos_explicitos x on x.ocorrencia_preparada_id=c.preparada_id where c.ciclo_id=v_ciclo) then raise exception 'efeito_sso_exige_reconciliacao' using errcode='23514';end if;
  if exists(select 1 from pcm.sso_selos_reserva_futura_rascunho s join pcm.sso_escolhas_reserva_futura_rascunho e on e.request_id=s.escolha_request_id join pcm.plano_versoes ov on ov.id=s.versao_id and ov.estado='aprovado' and ov.vigencia_inicio<=e.data_sso and (ov.vigencia_fim is null or ov.vigencia_fim>=e.data_sso) where ((s.modo='calendario' and s.ciclo_id=v_ciclo) or (e.legado_id=v_item.legado_id and e.indice_legado=v_item.indice_legado)) and not (e.plano_id=v_item.plano_id and s.versao_id=new.versao_anterior_id and e.data_sso>=new.vigencia_inicio)) then raise exception 'selo_reserva_conflitante' using errcode='23505';end if;
  insert into pcm.sso_selos_reserva_futura_rascunho(escolha_request_id,versao_id,vigencia,modo,ciclo_id,reserva_anterior_id) values(v_item.request_id,v_item.rascunho_id,new.vigencia_inicio,'calendario',v_ciclo,v_anterior);
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_selar_reserva_calendario_rascunho() from public,anon,authenticated,service_role;
create trigger sso_selar_reserva_calendario_rascunho after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_selar_reserva_calendario_rascunho();

-- Entradas mediadas: ator e permissões são conferidos no servidor.
grant execute on function pcm.sso_prever_reserva_calendario_rascunho(uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,integer) to authenticated;
grant execute on function pcm.sso_escolher_reserva_calendario_rascunho(uuid,uuid,uuid,uuid,uuid,uuid,integer,uuid,integer,integer,integer,text,boolean,text,jsonb) to authenticated;
