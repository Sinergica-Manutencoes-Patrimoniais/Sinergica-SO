-- ADR-1081: usa regra efetiva mantendo origem e ACLs existentes.
create or replace function pcm.sso_preparar_ocorrencia_por_visita(p_request_id uuid,p_ocorrencia_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,
  p_visita_id uuid,p_expected_revision integer,p_fonte_dia_util text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_plano pcm.planos_manutencao%rowtype;v_versao pcm.plano_versoes%rowtype;
  v_origem pcm.visita_origem_contratual%rowtype;v_visita pcm.visitas%rowtype;v_regra pcm.regras_visita_contratual%rowtype;
  v_rotina jsonb;v_total integer;v_logica uuid;v_tipo text;v_alvo uuid;v_vencimento date;v_comando pcm.calendario_contratual_comandos%rowtype;
  v_payload jsonb;v_resultado jsonb;v_existente uuid;v_visita_existente uuid;v_plano_existente uuid;v_vencimento_existente date;v_criada boolean;
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
  select * into v_regra from pcm.regras_visita_contratual where id=pcm.sso_regra_efetiva_visita(p_visita_id) and serie_id=v_origem.serie_id;
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
    select id,visita_id,plano_id,vencimento_original into v_existente,v_visita_existente,v_plano_existente,v_vencimento_existente from pcm.ocorrencias_visita_preparadas where rotina_logica_id=v_logica and alvo_tipo=v_tipo and alvo_id=v_alvo
      and serie_id=v_origem.serie_id and semana_origem=v_origem.semana_origem;
    if v_existente is null or v_visita_existente is distinct from p_visita_id or v_plano_existente is distinct from p_plano_id then raise exception 'visita_ciclo_exige_reconciliacao' using errcode='23514'; end if;
    -- O recibo deve refletir a data histórica salva, não a data calculada
    -- novamente a partir da regra efetiva da Visita.
    v_vencimento:=v_vencimento_existente;
  end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'ocorrenciaId',v_existente,'visitaId',p_visita_id,'vencimentoOriginal',v_vencimento,'preparada',true,'criada',v_criada);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ocorrencia_visita_preparada','planos_manutencao',p_plano_id,v_resultado);
  insert into pcm.calendario_contratual_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,v_plano.cliente_id,v_payload,v_resultado);
  return v_resultado;
end;
$$;

create or replace function pcm.sso_prever_visitas_rotina(p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_serie_id uuid,p_inicio date,p_fim date,p_apos uuid,p_limite integer)
returns table(visita_id uuid,semana_origem date,vencimento_original date,estado_visita text,feriado_declarado boolean,vigencia_declarada boolean,ocorrencia_preparada boolean)
language plpgsql stable security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;
begin
  if not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_bloqueada' using errcode='55000'; end if;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id;
  if auth.uid() is null or not found or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>366
    or p_limite is null or p_limite not between 1 and 100 then raise exception 'consulta_invalida' using errcode='22023'; end if;
  select r.* into v_rotina from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id and v.plano_id=r.plano_id and v.estado='aprovado'
    where r.id=p_rotina_id and r.plano_id=p_plano_id and r.versao_id=p_versao_id and r.modo='visita';
  if not found or not exists(select 1 from pcm.rotina_visita_serie_vinculos v join pcm.calendario_contratual_series s on s.id=v.serie_id and s.cliente_id=v_plano.cliente_id
    where v.plano_id=p_plano_id and v.rotina_logica_id=v_rotina.rotina_logica_id and v.serie_id=p_serie_id) then raise exception 'vinculo_indisponivel' using errcode='23514'; end if;
  return query select v.id,o.semana_origem,o.semana_origem+(r.dia_semana-1),v.estado,
    exists(select 1 from pcm.feriados_declarados f where f.cliente_id=v_plano.cliente_id and f.ativo and f.data=o.semana_origem+(r.dia_semana-1)
      and (f.contrato_id is null or f.contrato_id=o.contrato_id)),
    exists(select 1 from pcm.rotina_serie_vigencias g where g.plano_id=p_plano_id and g.rotina_logica_id=v_rotina.rotina_logica_id and g.serie_id=p_serie_id
      and g.inicio<=o.semana_origem+(r.dia_semana-1) and (g.fim is null or g.fim>=o.semana_origem+(r.dia_semana-1))),
    exists(select 1 from pcm.ocorrencias_visita_preparadas oc where oc.plano_id=p_plano_id and oc.rotina_logica_id=v_rotina.rotina_logica_id
      and oc.serie_id=p_serie_id and oc.semana_origem=o.semana_origem)
    from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id
    join pcm.regras_visita_contratual r on r.id=pcm.sso_regra_efetiva_visita(o.visita_id) and r.serie_id=o.serie_id
    where o.cliente_id=v_plano.cliente_id and o.serie_id=p_serie_id and v.estado not in ('cancelada','concluida')
      and o.semana_origem+(r.dia_semana-1) between p_inicio and p_fim and (p_apos is null or v.id>p_apos)
    order by v.id limit p_limite;
end;
$$;
