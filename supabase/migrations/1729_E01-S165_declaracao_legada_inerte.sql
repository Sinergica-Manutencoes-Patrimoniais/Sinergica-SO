-- ADR-1587: apenas declaração auditada; a guarda 1724 permanece inalterada.
create table pcm.sso_declaracoes_legada_inerte (
 request_id uuid primary key,sequencia bigint generated always as identity unique,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 legada_id uuid not null references pcm.ocorrencias_preventivas(id),escolha_request_id uuid not null references pcm.sso_selos_reserva_futura_rascunho(escolha_request_id),
 ator_id uuid not null references auth.users(id),motivo text not null,fotografia jsonb not null,payload jsonb not null,resultado jsonb not null,
 criado_em timestamptz not null default clock_timestamp()
);
alter table pcm.sso_declaracoes_legada_inerte enable row level security;
alter table pcm.sso_declaracoes_legada_inerte force row level security;
revoke all on pcm.sso_declaracoes_legada_inerte from public,anon,authenticated,service_role;
create trigger sso_declaracao_legada_inerte_imutavel before update or delete on pcm.sso_declaracoes_legada_inerte for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Prévia não utiliza o helper 1724, que continua a recusar qualquer linha legada.
create function pcm.sso_prever_reconciliacao_legada_sso(p_ator uuid,p_cliente uuid,p_plano uuid,p_legada uuid,p_escolha uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e pcm.sso_escolhas_reserva_futura_rascunho%rowtype;s pcm.sso_selos_reserva_futura_rascunho%rowtype;
 l pcm.ocorrencias_preventivas%rowtype;v pcm.plano_versoes%rowtype;v_foto jsonb;v_regra jsonb;v_q integer;v_campo text;v_efeito_sso boolean;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 if p_plano is null or p_legada is null or p_escolha is null then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 lock table pcm.sso_escolhas_reserva_futura_rascunho,pcm.sso_selos_reserva_futura_rascunho,pcm.plano_versoes,pcm.planos_preventivos,pcm.ocorrencias_preventivas,pcm.ordens_servico,pcm.sso_chamados_ciclo_preventivo,pcm.sso_chamados_ciclo_visita,pcm.sso_ciclo_calendario_versoes,pcm.sso_ciclo_visita_versoes,pcm.sso_ocorrencias_grupo,pcm.os_rotina_vinculos_explicitos,pcm.avaliacoes_preventivas,pcm.ocorrencias_rotina_vinculos,pcm.sso_vinculos_visita_legado,pcm.sso_reservas_ciclo_legado,pcm.sso_declaracoes_planos_legados,pcm.sso_legados_nao_relacionados in share mode nowait;
 select * into e from pcm.sso_escolhas_reserva_futura_rascunho where request_id=p_escolha and cliente_id=p_cliente and plano_id=p_plano and decisao='somente_sso';
 if not found then raise exception 'escolha_indisponivel' using errcode='42501';end if;
 if e.modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);end if;
 select * into s from pcm.sso_selos_reserva_futura_rascunho where escolha_request_id=e.request_id;
 if not found or s.versao_id is distinct from e.rascunho_id or s.modo is distinct from e.modo then raise exception 'selo_indisponivel' using errcode='23514';end if;
 if s.vigencia>pcm.sso_data_civil_transicao_plano(p_plano,s.versao_id,s.vigencia) then raise exception 'selo_ainda_nao_vigente' using errcode='23514';end if;
 select * into v from pcm.plano_versoes where id=s.versao_id and plano_id=p_plano and estado='aprovado' and vigencia_inicio=s.vigencia and vigencia_inicio<=e.data_sso and (vigencia_fim is null or vigencia_fim>=e.data_sso) for share nowait;
 if not found or jsonb_typeof(v.snapshot->'rotinas') is distinct from 'array' then raise exception 'versao_indisponivel' using errcode='23514';end if;
 if (select count(*) from pcm.plano_versoes x where x.plano_id=p_plano and x.estado='aprovado' and x.vigencia_inicio<=e.data_sso and (x.vigencia_fim is null or x.vigencia_fim>=e.data_sso))<>1 then raise exception 'versao_indeterminada' using errcode='23514';end if;
 if (select count(*) from pcm.sso_selos_reserva_futura_rascunho sx join pcm.sso_escolhas_reserva_futura_rascunho ex on ex.request_id=sx.escolha_request_id join pcm.plano_versoes vx on vx.id=sx.versao_id and vx.estado='aprovado' and vx.vigencia_inicio<=ex.data_sso and (vx.vigencia_fim is null or vx.vigencia_fim>=ex.data_sso) where (sx.modo=s.modo and sx.ciclo_id=s.ciclo_id) or (ex.legado_id=e.legado_id and ex.indice_legado=e.indice_legado))<>1 then raise exception 'selo_conflitante' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_q,v_regra from jsonb_array_elements(v.snapshot->'rotinas') x(item) where item->>'id'=e.rotina_id::text;
 if v_q<>1 then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 foreach v_campo in array array['id','rotina_logica_id','modo','alvo_tipo','sistema_id','equipamento_id','grupo_id','data_base','intervalo_n','intervalo_unidade','questionario_id'] loop
  if v_regra->>v_campo is distinct from e.foto->'regraSso'->>v_campo then raise exception 'regra_obsoleta' using errcode='23514';end if;
 end loop;
 v_foto:=pcm.sso_foto_reserva_ciclo(p_plano,e.legado_id);
 if v_foto is null then raise exception 'fonte_obsoleta' using errcode='23514';end if;
 for v_campo in select key from jsonb_object_keys(v_foto) k(key) where key<>'planoRevisao' loop
  if v_foto->v_campo is distinct from e.foto->v_campo then raise exception 'fonte_obsoleta' using errcode='23514';end if;
 end loop;
 if (s.modo='calendario' and not exists(select 1 from pcm.sso_ciclos_calendario_canonicos c join pcm.sso_series_ciclo_calendario t on t.id=c.serie_id where c.id=s.ciclo_id and c.indice=e.indice_sso and c.vencimento_original=e.data_sso and t.plano_id=e.plano_id and t.rotina_logica_id=(v_regra->>'rotina_logica_id')::uuid))
  or (s.modo='visita' and not exists(select 1 from pcm.sso_ciclos_visita_canonicos c where c.id=s.ciclo_id and c.plano_id=e.plano_id and c.rotina_logica_id=(v_regra->>'rotina_logica_id')::uuid and c.serie_id=(e.foto->'origemVisita'->>'serie_id')::uuid and c.semana_origem=(e.foto->'origemVisita'->>'semana_origem')::date)) then raise exception 'identidade_incompativel' using errcode='23514';end if;
 if exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.ativa and ((r.modo=s.modo and r.ciclo_id=s.ciclo_id) or (r.legado_id=e.legado_id and r.indice_legado=e.indice_legado)) and (r.id is distinct from s.reserva_anterior_id or r.cliente_id is distinct from e.cliente_id or r.plano_id is distinct from e.plano_id or r.modo is distinct from s.modo or r.ciclo_id is distinct from s.ciclo_id or r.legado_id is distinct from e.legado_id or r.indice_legado is distinct from e.indice_legado)) or (s.reserva_anterior_id is not null and not exists(select 1 from pcm.sso_reservas_ciclo_legado r where r.id=s.reserva_anterior_id and r.ativa and r.cliente_id=e.cliente_id and r.plano_id=e.plano_id and r.modo=s.modo and r.ciclo_id=s.ciclo_id and r.legado_id=e.legado_id and r.indice_legado=e.indice_legado)) then raise exception 'reserva_conflitante' using errcode='23514';end if;
 if s.modo='visita' then
  lock table pcm.visitas,pcm.visita_origem_contratual,pcm.regras_visita_contratual,pcm.sso_visita_regra_transicoes,pcm.feriados_declarados,pcm.sso_visitas_suprimidas_feriado,pcm.visita_ordens_servico,pcm.rotina_visita_serie_vinculos,pcm.rotina_serie_vigencias in share mode nowait;
  if not exists(select 1 from pcm.visitas x where x.id=(e.foto->'visita'->>'id')::uuid and to_jsonb(x)=e.foto->'visita')
   or not exists(select 1 from pcm.visita_origem_contratual x where x.visita_id=(e.foto->'origemVisita'->>'visita_id')::uuid and to_jsonb(x)=e.foto->'origemVisita')
   or not exists(select 1 from pcm.regras_visita_contratual x where x.id=(e.foto->'regraVisita'->>'id')::uuid and x.id=pcm.sso_regra_efetiva_visita((e.foto->'visita'->>'id')::uuid) and to_jsonb(x)=e.foto->'regraVisita')
   or not exists(select 1 from pcm.rotina_visita_serie_vinculos a join pcm.rotina_serie_vigencias g on g.plano_id=a.plano_id and g.rotina_logica_id=a.rotina_logica_id and g.serie_id=a.serie_id where a.plano_id=e.plano_id and a.rotina_logica_id=(v_regra->>'rotina_logica_id')::uuid and a.serie_id=(e.foto->'origemVisita'->>'serie_id')::uuid and g.inicio<=e.data_sso and (g.fim is null or g.fim>=e.data_sso))
   or exists(select 1 from pcm.visita_ordens_servico x where x.visita_id=(e.foto->'visita'->>'id')::uuid and x.encerrado_em is null)
   or exists(select 1 from pcm.feriados_declarados x where x.cliente_id=e.cliente_id and x.ativo and x.data=e.data_sso and (x.contrato_id is null or x.contrato_id=(e.foto->'origemVisita'->>'contrato_id')::uuid))
   or exists(select 1 from pcm.sso_visitas_suprimidas_feriado x where x.visita_id=(e.foto->'visita'->>'id')::uuid) then raise exception 'visita_obsoleta' using errcode='23514';end if;
 end if;
 select * into l from pcm.ocorrencias_preventivas where id=p_legada and plano_id=e.legado_id and indice=e.indice_legado for share nowait;
 if not found or l.origem is distinct from 'legado' then raise exception 'legada_indisponivel' using errcode='42501';end if;
 v_efeito_sso:=case when s.modo='calendario' then exists(select 1 from pcm.sso_chamados_ciclo_preventivo where ciclo_id=s.ciclo_id) or exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.sso_ocorrencias_grupo g on g.calendario_preparado_id=c.preparada_id where c.ciclo_id=s.ciclo_id) or exists(select 1 from pcm.sso_ciclo_calendario_versoes c join pcm.os_rotina_vinculos_explicitos x on x.ocorrencia_preparada_id=c.preparada_id where c.ciclo_id=s.ciclo_id)
 else exists(select 1 from pcm.sso_chamados_ciclo_visita where ciclo_id=s.ciclo_id) or exists(select 1 from pcm.sso_ciclo_visita_versoes c join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=c.preparada_id where c.ciclo_id=s.ciclo_id) end;
 v_foto:=jsonb_build_object('clienteId',p_cliente,'planoId',p_plano,'legadaId',l.id,'legadoId',l.plano_id,'indice',l.indice,'vencimento',l.vencimento,
  'envioEstado',l.envio_estado,'resultadoEstado',l.resultado_estado,'auvoTaskId',l.auvo_task_id,'visitaEm',l.visita_em,'tecnicoId',l.tecnico_funcionario_id,'osExistente',exists(select 1 from pcm.ordens_servico os where os.ocorrencia_preventiva_id=l.id),
  'avaliacoesExistentes',exists(select 1 from pcm.avaliacoes_preventivas a where a.ocorrencia_id=l.id),
  'ponteExistente',exists(select 1 from pcm.ocorrencias_rotina_vinculos b where b.ocorrencia_legada_id=l.id) or exists(select 1 from pcm.sso_vinculos_visita_legado b where b.ocorrencia_legada_id=l.id),
  'escolhaRequestId',e.request_id,'versaoId',s.versao_id,'modo',s.modo,'cicloId',s.ciclo_id,'vigencia',s.vigencia,'efeitoSso',v_efeito_sso,
  'fonteEstrutural',pcm.sso_foto_reserva_ciclo(p_plano,e.legado_id));
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 return jsonb_build_object('foto',v_foto,'registroPreparativo',true,'execucaoAutorizada',false);
end; $$;
revoke all on function pcm.sso_prever_reconciliacao_legada_sso(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- O registro nao altera a linha legada nem muda a guarda operacional.
create function pcm.sso_reconciliar_legada_sso(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_legada uuid,p_escolha uuid,p_motivo text,p_foto_esperada jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_declaracoes_legada_inerte%rowtype;v_foto jsonb;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');v_modo text;
begin
 if p_request is null or p_foto_esperada is null or jsonb_typeof(p_foto_esperada) is distinct from 'object' or v_motivo is null or length(v_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,true);
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'legada',p_legada,'escolha',p_escolha,'motivo',v_motivo,'fotoEsperada',p_foto_esperada);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-legada-inerte:'||p_request::text,0));
 select * into v_ant from pcm.sso_declaracoes_legada_inerte where request_id=p_request;
 if found then
  if v_ant.ator_id is distinct from p_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;
  perform 1 from pcm.planos_manutencao where id=v_ant.plano_id and cliente_id=p_cliente for share nowait;
  if not found then raise exception 'sem_acesso' using errcode='42501';end if;
  if v_ant.fotografia->>'modo'='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);end if;
  perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
  return v_ant.resultado;
 end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 v_foto:=pcm.sso_prever_reconciliacao_legada_sso(p_ator,p_cliente,p_plano,p_legada,p_escolha)->'foto';
 if v_foto is distinct from p_foto_esperada then raise exception 'fotografia_obsoleta' using errcode='40001';end if;
 if v_foto->>'envioEstado' is distinct from 'prevista' or v_foto->>'resultadoEstado' is distinct from 'pendente'
  or v_foto->'auvoTaskId' is distinct from 'null'::jsonb or v_foto->'visitaEm' is distinct from 'null'::jsonb or v_foto->'tecnicoId' is distinct from 'null'::jsonb
  or v_foto->>'osExistente' is distinct from 'false' or v_foto->>'avaliacoesExistentes' is distinct from 'false' or v_foto->>'ponteExistente' is distinct from 'false'
  or v_foto->>'efeitoSso' is distinct from 'false' then raise exception 'efeito_exige_reconciliacao' using errcode='23514';end if;
 v_modo:=v_foto->>'modo';if v_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,true);end if;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 v_resultado:=jsonb_build_object('requestId',p_request,'legadaId',p_legada,'escolhaRequestId',p_escolha,
  'declaracaoRegistrada',true,'integracaoOperacionalPendente',pg_catalog.to_regprocedure('pcm.sso_estados_legadas_inertes(uuid,uuid[])') is null,'legadaAlterada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_declaracoes_legada_inerte(request_id,cliente_id,plano_id,legada_id,escolha_request_id,ator_id,motivo,fotografia,payload,resultado)
 values(p_request,p_cliente,p_plano,p_legada,p_escolha,p_ator,v_motivo,v_foto,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'plano.legada_inerte_declarada','planos_manutencao',p_plano,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_reconciliar_legada_sso(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;

create function pcm.sso_consultar_declaracao_legada_sso(p_ator uuid,p_cliente uuid,p_plano uuid,p_legada uuid,p_escolha uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_foto jsonb;v pcm.sso_declaracoes_legada_inerte%rowtype;
begin
 v_foto:=pcm.sso_prever_reconciliacao_legada_sso(p_ator,p_cliente,p_plano,p_legada,p_escolha)->'foto';
 select * into v from pcm.sso_declaracoes_legada_inerte where cliente_id=p_cliente and plano_id=p_plano and legada_id=p_legada and escolha_request_id=p_escolha order by sequencia desc limit 1;
 if not found then return jsonb_build_object('registrada',false,'fotoAtual',v_foto,'integracaoOperacionalPendente',pg_catalog.to_regprocedure('pcm.sso_estados_legadas_inertes(uuid,uuid[])') is null);end if;
 return jsonb_build_object('registrada',true,'fotoAtual',v_foto,'fotografiaAtual',v.fotografia is not distinct from v_foto,
  'requestId',v.request_id,'motivo',v.motivo,'registradaEm',v.criado_em,'integracaoOperacionalPendente',pg_catalog.to_regprocedure('pcm.sso_estados_legadas_inertes(uuid,uuid[])') is null);
end; $$;
revoke all on function pcm.sso_consultar_declaracao_legada_sso(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

-- Listagem por Plano; pares ambíguos são sinalizados sem escolher um automaticamente.
create function pcm.sso_listar_legadas_inertes_sso(p_ator uuid,p_cliente uuid,p_plano uuid,p_apos uuid,p_limite integer)
returns table(legada_id uuid,escolha_request_id uuid,vencimento date,modo text,conflitante boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'paginacao_invalida' using errcode='22023';end if;
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 lock table pcm.sso_escolhas_reserva_futura_rascunho,pcm.sso_selos_reserva_futura_rascunho,pcm.plano_versoes,pcm.ocorrencias_preventivas in share mode nowait;
 return query with pares as (
  select l.id legada,s.escolha_request_id escolha,l.vencimento data,s.modo tipo
  from pcm.sso_selos_reserva_futura_rascunho s
  join pcm.sso_escolhas_reserva_futura_rascunho e on e.request_id=s.escolha_request_id and e.cliente_id=p_cliente and e.plano_id=p_plano and e.decisao='somente_sso'
  join pcm.plano_versoes v on v.id=s.versao_id and v.plano_id=e.plano_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia and v.vigencia_inicio<=e.data_sso and (v.vigencia_fim is null or v.vigencia_fim>=e.data_sso)
  join pcm.ocorrencias_preventivas l on l.plano_id=e.legado_id and l.indice=e.indice_legado and l.origem='legado'
  where (p_apos is null or l.id>p_apos) and s.vigencia<=pcm.sso_data_civil_transicao_plano(e.plano_id,s.versao_id,s.vigencia)
 ), agrupado as (select p.legada,count(*) n,min(p.escolha::text)::uuid escolha,min(p.data) data,min(p.tipo) tipo from pares p group by p.legada)
 select a.legada,case when a.n=1 then a.escolha else null end,a.data,case when a.n=1 then a.tipo else null end,a.n<>1
 from agrupado a order by a.legada limit p_limite;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
end; $$;
revoke all on function pcm.sso_listar_legadas_inertes_sso(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

-- Histórico permanece consultável se a fonte operacional ficou obsoleta.
create function pcm.sso_historico_declaracao_legada_sso(p_ator uuid,p_cliente uuid,p_plano uuid,p_legada uuid,p_escolha uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_declaracoes_legada_inerte%rowtype;v_modo text;
begin
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 perform 1 from pcm.planos_manutencao where id=p_plano and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'sem_acesso' using errcode='42501';end if;
 select modo into v_modo from pcm.sso_escolhas_reserva_futura_rascunho where request_id=p_escolha and cliente_id=p_cliente and plano_id=p_plano;
 if not found then raise exception 'escolha_indisponivel' using errcode='42501';end if;
 if v_modo='visita' then perform pcm.sso_exigir_visita_ponte(p_ator,p_cliente,false);end if;
 select * into v from pcm.sso_declaracoes_legada_inerte where cliente_id=p_cliente and plano_id=p_plano and legada_id=p_legada and escolha_request_id=p_escolha order by sequencia desc limit 1;
 perform pcm.sso_conferir_ponte_legada_mediada(p_ator,p_cliente,false);
 if v.request_id is null then return jsonb_build_object('registrada',false);end if;
 return jsonb_build_object('registrada',true,'requestId',v.request_id,'motivo',v.motivo,'atorId',v.ator_id,'registradaEm',v.criado_em,'integracaoOperacionalPendente',pg_catalog.to_regprocedure('pcm.sso_estados_legadas_inertes(uuid,uuid[])') is null);
end; $$;
revoke all on function pcm.sso_historico_declaracao_legada_sso(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
