-- ADR-0530: geração durante revisão somente para versão anterior comprovada.
create table pcm.sso_geracao_versao_anterior_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_geracao_versao_anterior_gate enable row level security;alter table pcm.sso_geracao_versao_anterior_gate force row level security;
revoke all on pcm.sso_geracao_versao_anterior_gate from public,anon,authenticated,service_role;
insert into pcm.sso_geracao_versao_anterior_gate(id,habilitado) values(true,false);

create function pcm.sso_plano_permite_gerar_versao(p_plano_id uuid,p_versao_id uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_estado text;v_rascunho uuid;
begin
 select estado into v_estado from pcm.planos_manutencao where id=p_plano_id;
 if not found then return false;end if;
 if not exists(select 1 from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado') then return false;end if;
 if v_estado in ('aprovado','ativo') then return true;end if;
 if v_estado not in ('rascunho','em_revisao') or not coalesce((select habilitado from pcm.sso_geracao_versao_anterior_gate where id),false) then return false;end if;
 select id into v_rascunho from pcm.plano_versoes where plano_id=p_plano_id and estado='rascunho';
 if v_rascunho is null then return false;end if;
 return exists(select 1 from pcm.plano_comandos c join audit.events e on e.entity='planos_manutencao' and e.entity_id=p_plano_id and e.action='plano.revisao_iniciada' and e.actor_id=c.actor_id and e.payload->>'requestId'=c.request_id::text and e.payload->>'versaoId'=v_rascunho::text and e.payload->>'origem'=p_versao_id::text
 where c.payload->>'tipo'='iniciarRevisaoPlano' and c.payload->>'planoId'=p_plano_id::text and c.resultado->'linkedIds'->>'versaoId'=v_rascunho::text and c.resultado->'linkedIds'->>'versaoOrigemId'=p_versao_id::text);
end; $$;
revoke all on function pcm.sso_plano_permite_gerar_versao(uuid,uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_materializar_rotina_calendario(
  p_request_id uuid, p_plano_id uuid, p_versao_id uuid, p_rotina_id uuid,
  p_expected_revision integer, p_inicio date, p_fim date
) returns jsonb language plpgsql security definer set search_path = '' set timezone = 'America/Sao_Paulo' as $$
declare
  v_actor uuid := auth.uid(); v_plano pcm.planos_manutencao%rowtype; v_versao pcm.plano_versoes%rowtype;
  v_rotina jsonb; v_quantidade integer; v_logica uuid; v_alvo uuid; v_tipo text;
  v_linha record; v_criadas integer := 0; v_inseridas integer; v_comando pcm.calendario_contratual_comandos%rowtype;
  v_payload jsonb; v_resultado jsonb;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id), false) then
    raise exception 'materializacao_bloqueada' using errcode = '55000'; end if;
  if v_actor is null or p_request_id is null or p_plano_id is null or p_versao_id is null
    or p_rotina_id is null or p_expected_revision is null or p_expected_revision < 1
    or p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim)
    or p_fim < p_inicio then
    raise exception 'janela_invalida' using errcode = '22023'; end if;
  v_payload := jsonb_build_object('tipo', 'materializarRotinaCalendario', 'planoId', p_plano_id,
    'versaoId', p_versao_id, 'rotinaId', p_rotina_id, 'expectedRevision', p_expected_revision,
    'inicio', p_inicio, 'fim', p_fim);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:' || p_request_id::text, 0));
  select * into v_comando from pcm.calendario_contratual_comandos where request_id = p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor
      or config.sso_autorizar_acao('plano.gerir', v_comando.cliente_id) is distinct from true then
      raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
    return v_comando.resultado;
  end if;
  if p_inicio < current_date or p_fim > current_date + 30 then
    raise exception 'janela_invalida' using errcode = '22023'; end if;
  select * into v_plano from pcm.planos_manutencao where id = p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir', v_plano.cliente_id) is distinct from true then
    raise exception 'plano_nao_encontrado_ou_sem_acesso' using errcode = '42501'; end if;
  if v_plano.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
  if not pcm.sso_plano_permite_gerar_versao(p_plano_id,p_versao_id) then raise exception 'plano_nao_ativo' using errcode = '23514'; end if;
  select * into v_versao from pcm.plano_versoes where id = p_versao_id and plano_id = p_plano_id for share;
  if not found or v_versao.estado <> 'aprovado' or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then
    raise exception 'versao_indisponivel' using errcode = '23514'; end if;
  select count(*), min(r.item::text)::jsonb into v_quantidade, v_rotina
    from jsonb_array_elements(v_versao.snapshot->'rotinas') r(item) where r.item->>'id' = p_rotina_id::text;
  if v_quantidade <> 1 or v_rotina->>'modo' is distinct from 'calendario' then
    raise exception 'rotina_indisponivel' using errcode = '23514'; end if;
  v_logica := (v_rotina->>'rotina_logica_id')::uuid;
  v_tipo := v_rotina->>'alvo_tipo';
  v_alvo := case v_tipo when 'sistema' then (v_rotina->>'sistema_id')::uuid
    when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;
  if v_logica is null or v_alvo is null or not exists (select 1 from pcm.rotina_origem_geracao g
    where g.rotina_logica_id = v_logica and g.alvo_tipo = v_tipo and g.alvo_id = v_alvo and g.origem = 'plano') then
    raise exception 'origem_geracao_nao_comprovada' using errcode = '23514'; end if;
  for v_linha in select * from pcm.sso_prever_ciclos_rotina(p_plano_id, p_versao_id, p_rotina_id, p_inicio, p_fim) loop
    insert into pcm.ocorrencias_rotina_preparadas(plano_id, versao_id, rotina_id, rotina_logica_id,
      alvo_tipo, alvo_id, ciclo, vencimento_original, tolerancia_antes, tolerancia_depois, created_by)
      values (p_plano_id, p_versao_id, p_rotina_id, v_logica, v_tipo, v_alvo, v_linha.ciclo,
        v_linha.vencimento, v_linha.tolerancia_antes, v_linha.tolerancia_depois, v_actor)
      on conflict (rotina_logica_id, alvo_tipo, alvo_id, vencimento_original) do nothing;
    get diagnostics v_inseridas = row_count;
    v_criadas := v_criadas + v_inseridas;
  end loop;
  v_resultado := jsonb_build_object('planoId', p_plano_id, 'rotinaId', p_rotina_id, 'criadas', v_criadas, 'requestId', p_request_id);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_actor, 'calendario.ocorrencias_preparadas', 'planos_manutencao', p_plano_id, v_resultado);
  insert into pcm.calendario_contratual_comandos(request_id, actor_id, cliente_id, payload, resultado)
    values (p_request_id, v_actor, v_plano.cliente_id, v_payload, v_resultado);
  return v_resultado;
end;
$$;

create or replace function pcm.sso_preparar_ocorrencia_por_visita(p_request_id uuid,p_ocorrencia_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,
  p_visita_id uuid,p_expected_revision integer,p_fonte_dia_util text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_versao pcm.plano_versoes%rowtype;
  v_origem pcm.visita_origem_contratual%rowtype;v_visita pcm.visitas%rowtype;v_regra pcm.regras_visita_contratual%rowtype;
  v_rotina jsonb;v_total integer;v_logica uuid;v_tipo text;v_alvo uuid;v_vencimento date;v_comando pcm.calendario_contratual_comandos%rowtype;
  v_payload jsonb;v_resultado jsonb;v_existente uuid;v_visita_existente uuid;v_criada boolean;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
  if v_actor is null or p_request_id is null or p_ocorrencia_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_visita_id is null
    or p_expected_revision is null or p_expected_revision<1 or p_fonte_dia_util is null or length(btrim(p_fonte_dia_util)) not between 1 and 500 then raise exception 'comando_invalido' using errcode='22023'; end if;
  v_payload:=jsonb_build_object('tipo','prepararOcorrenciaVisita','ocorrenciaId',p_ocorrencia_id,'planoId',p_plano_id,'versaoId',p_versao_id,
    'rotinaId',p_rotina_id,'visitaId',p_visita_id,'expectedRevision',p_expected_revision,'fonteDiaUtil',btrim(p_fonte_dia_util));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
  select * into v_comando from pcm.calendario_contratual_comandos where request_id=p_request_id;
  if found then
    if v_comando.actor_id is distinct from v_actor or config.sso_autorizar_acao('plano.gerir',v_comando.cliente_id) is distinct from true
      or config.sso_autorizar_acao('visita.confirmar',v_comando.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
    if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_comando.resultado;
  end if;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id for update;
  if not found or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
  if not pcm.sso_plano_permite_gerar_versao(p_plano_id,p_versao_id) then raise exception 'plano_inativo' using errcode='23514'; end if;
  select * into v_origem from pcm.visita_origem_contratual where visita_id=p_visita_id and cliente_id=v_plano.cliente_id;
  if not found then raise exception 'origem_contratual_nao_comprovada' using errcode='23514'; end if;
  select * into v_visita from pcm.visitas where id=p_visita_id and cliente_id=v_plano.cliente_id and estado not in ('cancelada','concluida') for share;
  if not found then raise exception 'visita_indisponivel' using errcode='23514'; end if;
  select * into v_regra from pcm.regras_visita_contratual where id=v_origem.regra_id and serie_id=v_origem.serie_id;
  if not found or v_origem.semana_origem<v_regra.ancora_semana or mod(v_origem.semana_origem-v_regra.ancora_semana,7*v_regra.intervalo_semanas)<>0 then
    raise exception 'semana_incompativel' using errcode='23514'; end if;
  v_vencimento:=v_origem.semana_origem+(v_regra.dia_semana-1);
  if v_vencimento<v_regra.vigencia_inicio or (v_regra.vigencia_fim is not null and v_vencimento>v_regra.vigencia_fim) then raise exception 'regra_fora_vigencia' using errcode='23514'; end if;
  if exists(select 1 from pcm.feriados_declarados f where f.cliente_id=v_plano.cliente_id and f.ativo and f.data=v_vencimento
    and (f.contrato_id is null or f.contrato_id=v_origem.contrato_id)) then raise exception 'feriado_declarado' using errcode='23514'; end if;
  select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
  if not found or v_versao.vigencia_inicio is null or v_vencimento<v_versao.vigencia_inicio
    or (v_versao.vigencia_fim is not null and v_vencimento>v_versao.vigencia_fim)
    or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'versao_indisponivel' using errcode='23514'; end if;
  select count(*),min(item::text)::jsonb into v_total,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') r(item) where item->>'id'=p_rotina_id::text;
  if v_total<>1 or v_rotina->>'modo' is distinct from 'visita' or v_rotina->>'intervalo_n' is distinct from '1'
    or v_rotina->>'intervalo_unidade' is distinct from 'semanas' then raise exception 'rotina_incompativel' using errcode='23514'; end if;
  v_logica:=(v_rotina->>'rotina_logica_id')::uuid;v_tipo:=v_rotina->>'alvo_tipo';
  v_alvo:=case v_tipo when 'sistema' then (v_rotina->>'sistema_id')::uuid when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;
  if v_logica is null or v_alvo is null or not exists(select 1 from pcm.rotina_visita_serie_vinculos where rotina_logica_id=v_logica and serie_id=v_origem.serie_id and plano_id=p_plano_id)
    or not exists(select 1 from pcm.rotina_origem_geracao where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo and origem='plano') then
    raise exception 'origem_ou_vinculo_nao_comprovado' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  insert into pcm.ocorrencias_visita_preparadas(id,plano_id,versao_id,rotina_id,rotina_logica_id,alvo_tipo,alvo_id,serie_id,visita_id,semana_origem,vencimento_original,fonte_dia_util_declarada,criado_por)
    values(p_ocorrencia_id,p_plano_id,p_versao_id,p_rotina_id,v_logica,v_tipo,v_alvo,v_origem.serie_id,p_visita_id,v_origem.semana_origem,v_vencimento,btrim(p_fonte_dia_util),v_actor)
    on conflict(rotina_logica_id,alvo_tipo,alvo_id,serie_id,semana_origem) do nothing returning id into v_existente;
  v_criada:=found;
  if not v_criada then
    select id,visita_id into v_existente,v_visita_existente from pcm.ocorrencias_visita_preparadas where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo
      and serie_id=v_origem.serie_id and semana_origem=v_origem.semana_origem;
    if v_visita_existente is distinct from p_visita_id then raise exception 'visita_ciclo_exige_reconciliacao' using errcode='23514'; end if;
  end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'ocorrenciaId',v_existente,'visitaId',p_visita_id,'vencimentoOriginal',v_vencimento,'preparada',true,'criada',v_criada);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ocorrencia_visita_preparada','planos_manutencao',p_plano_id,v_resultado);
  insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_plano.cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;

create or replace function pcm.sso_materializar_ciclo_canonico(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_expected_revision integer,p_vencimento date)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_comando pcm.calendario_contratual_comandos%rowtype;v_n integer;v_logica uuid;v_tipo text;v_alvo uuid;v_ancora date;v_intervalo integer;v_unidade text;v_ciclo integer;v_preparada uuid;v_identidade jsonb;v_canonico uuid;v_serie uuid;v_previa record;v_payload jsonb;v_resultado jsonb;v_criada boolean:=false;v_existente pcm.sso_ciclo_canonico_usos_versao%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_materializar_ciclo_canonico_gate where id),false) or not coalesce((select habilitado from pcm.sso_identidade_ciclo_gate where id),false) or not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) or not coalesce((select habilitado from pcm.sso_guarda_ciclo_canonico_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null or p_expected_revision is null or p_expected_revision<1 or p_vencimento is null or not isfinite(p_vencimento) or p_vencimento<current_date or p_vencimento>current_date+30 then raise exception 'janela_invalida' using errcode='22023';end if;
 v_payload:=jsonb_build_object('tipo','materializarCicloCanonico','clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'expectedRevision',p_expected_revision,'vencimento',p_vencimento);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('calendario-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_comando from pcm.calendario_contratual_comandos where request_id=p_request_id;
 if found then if v_comando.actor_id is distinct from v_actor or v_comando.cliente_id is distinct from p_cliente_id or v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_comando.resultado;end if;
 select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found or not pcm.sso_plano_permite_gerar_versao(p_plano_id,p_versao_id) then raise exception 'plano_indisponivel' using errcode='23514';end if;
 if v_plano.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 select * into v_versao from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=p_rotina_id::text;
 if v_n<>1 or v_rotina->>'modo' is distinct from 'calendario' then raise exception 'rotina_indisponivel' using errcode='23514';end if;
 v_logica:=(v_rotina->>'rotina_logica_id')::uuid;v_tipo:=v_rotina->>'alvo_tipo';v_alvo:=case v_tipo when 'sistema' then (v_rotina->>'sistema_id')::uuid when 'componente' then (v_rotina->>'equipamento_id')::uuid when 'grupo' then (v_rotina->>'grupo_id')::uuid end;v_ancora:=(v_rotina->>'data_base')::date;v_intervalo:=(v_rotina->>'intervalo_n')::integer;v_unidade:=v_rotina->>'intervalo_unidade';
 if v_logica is null or v_alvo is null or not exists(select 1 from pcm.rotina_origem_geracao where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo and origem='plano') then raise exception 'origem_nao_comprovada' using errcode='23514';end if;
 select * into v_previa from pcm.sso_prever_ciclos_rotina(p_plano_id,p_versao_id,p_rotina_id,p_vencimento,p_vencimento);
 if not found then raise exception 'vencimento_nao_e_ciclo' using errcode='23514';end if;v_ciclo:=v_previa.ciclo;
 select s.id into v_serie from pcm.sso_series_ciclo_calendario s where s.plano_id=p_plano_id and s.rotina_logica_id=v_logica and s.alvo_tipo=v_tipo and s.alvo_id=v_alvo and s.ancora=v_ancora and s.intervalo_n=v_intervalo and s.intervalo_unidade=v_unidade;
 if v_serie is not null then select id into v_canonico from pcm.sso_ciclos_calendario_canonicos where serie_id=v_serie and indice=v_ciclo and vencimento_original=p_vencimento;end if;
 if v_canonico is not null then select preparada_id into v_preparada from pcm.sso_ciclo_calendario_versoes where ciclo_id=v_canonico order by criado_em limit 1;end if;
 if v_preparada is null then
  select id into v_preparada from pcm.ocorrencias_rotina_preparadas where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo and vencimento_original=p_vencimento;
  if v_preparada is not null then
   v_identidade:=pcm.sso_identificar_ciclo_calendario(gen_random_uuid(),p_cliente_id,v_preparada);v_canonico:=(v_identidade->>'cicloCanonicoId')::uuid;
   if not exists(select 1 from pcm.sso_ciclos_calendario_canonicos c join pcm.sso_series_ciclo_calendario s on s.id=c.serie_id where c.id=v_canonico and c.indice=v_ciclo and s.plano_id=p_plano_id and s.rotina_logica_id=v_logica and s.alvo_tipo=v_tipo and s.alvo_id=v_alvo and s.ancora=v_ancora and s.intervalo_n=v_intervalo and s.intervalo_unidade=v_unidade) then raise exception 'coincidencia_data_exige_reconciliacao' using errcode='23514';end if;
  else
   insert into pcm.sso_materializacao_canonica_tokens(txid,plano_id,versao_id,rotina_id,vencimento) values(pg_catalog.txid_current(),p_plano_id,p_versao_id,p_rotina_id,p_vencimento);
   perform pcm.sso_materializar_rotina_calendario(gen_random_uuid(),p_plano_id,p_versao_id,p_rotina_id,p_expected_revision,p_vencimento,p_vencimento);
   delete from pcm.sso_materializacao_canonica_tokens where txid=pg_catalog.txid_current() and plano_id=p_plano_id and versao_id=p_versao_id and rotina_id=p_rotina_id and vencimento=p_vencimento;
   select id into v_preparada from pcm.ocorrencias_rotina_preparadas where plano_id=p_plano_id and versao_id=p_versao_id and rotina_id=p_rotina_id and vencimento_original=p_vencimento;
   if v_preparada is null then raise exception 'ocorrencia_nao_materializada' using errcode='23514';end if;
   v_identidade:=pcm.sso_identificar_ciclo_calendario(gen_random_uuid(),p_cliente_id,v_preparada);v_canonico:=(v_identidade->>'cicloCanonicoId')::uuid;v_criada:=true;
  end if;
 end if;
 insert into pcm.sso_ciclo_canonico_usos_versao(ciclo_id,versao_id,rotina_id,preparada_id,ator_id) values(v_canonico,p_versao_id,p_rotina_id,v_preparada,v_actor) on conflict(ciclo_id,versao_id) do nothing;
 select * into v_existente from pcm.sso_ciclo_canonico_usos_versao where ciclo_id=v_canonico and versao_id=p_versao_id;
 if v_existente.rotina_id is distinct from p_rotina_id or v_existente.preparada_id is distinct from v_preparada then raise exception 'uso_versao_conflitante' using errcode='23505';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',v_preparada,'cicloCanonicoId',v_canonico,'indice',v_ciclo,'vencimentoOriginal',p_vencimento,'criada',v_criada,'osCriada',false,'tarefaAuvoCriada',false,'dataReferenciaUtc',current_date);
 insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ciclo_canonico_materializado','planos_manutencao',p_plano_id,v_resultado);return v_resultado;
end; $$;

create or replace function pcm.sso_guardar_insercao_ocorrencia_plano() returns trigger language plpgsql security definer set search_path='' as $$
declare v_estado text;
begin
 if not coalesce((select habilitado from pcm.sso_guarda_geracao_plano_gate where id),false) then return new; end if;
 select estado into v_estado from pcm.planos_manutencao where id=new.plano_id for share;
 if not found or not pcm.sso_plano_permite_gerar_versao(new.plano_id,new.versao_id) then raise exception 'plano_inativo_nao_gera_ocorrencia' using errcode='23514'; end if;
 return new;
end; $$;

