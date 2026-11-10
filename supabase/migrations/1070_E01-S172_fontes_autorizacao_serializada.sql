-- ADR-0885: mesmas fontes, guarda volátil; nenhum gate é habilitado.
create function pcm.sso_exigir_fontes_capacidade_autorizadas() returns void
language plpgsql volatile security definer set search_path='' as $$
begin
  if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_nao_suportado' using errcode='25001';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
    raise exception 'autorizacao_em_alteracao' using errcode='55P03';
  end if;
  perform 1 from pcm.capacidade_esforco_declarado_gate where id for share;
  perform 1 from pcm.capacidade_fontes_mediacao_gate where id for share;
  perform 1 from pcm.capacidade_demanda_gate where id for share;
  perform 1 from pcm.sso_fila_obrigacoes_preparadas_gate where id for share;
end; $$;
revoke all on function pcm.sso_exigir_fontes_capacidade_autorizadas() from public,anon,authenticated,service_role;

create function pcm.sso_fontes_demanda_autorizadas(p_cliente_id uuid,p_semana_inicio date,p_apos uuid default null,p_limite integer default 50)
returns table(vinculo_id uuid,visita_id uuid,os_id uuid,os_status text,ocorrencia_legada_id uuid,ocorrencia_preparada_id uuid,ciclo_id uuid,inicio_em timestamptz,fuso text,estimativa_os_minutos integer,participantes bigint,deslocamento_visita_minutos integer,completude text)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_fontes_capacidade_autorizadas();
  return query select * from pcm.sso_mediar_fontes_demanda_visita(p_cliente_id,p_semana_inicio,p_apos,p_limite);
end; $$;

create function pcm.sso_fontes_esforco_autorizadas(p_cliente_id uuid,p_semana_inicio date,p_apos uuid default null,p_limite integer default 50)
returns table(vinculo_id uuid,visita_id uuid,os_id uuid,os_status text,ocorrencia_legada_id uuid,ocorrencia_preparada_id uuid,ciclo_id uuid,inicio_em timestamptz,fuso text,estimativa_os_minutos integer,participantes bigint,deslocamento_visita_minutos integer,completude text,esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_fontes_capacidade_autorizadas();
  return query select * from pcm.sso_mediar_fontes_esforco_visita(p_cliente_id,p_semana_inicio,p_apos,p_limite);
end; $$;

create function pcm.sso_ocorrencias_sem_os_autorizadas(p_cliente_id uuid,p_semana_inicio date,p_apos_tipo text default null,p_apos_id uuid default null,p_limite integer default 50)
returns table(tipo text,ocorrencia_id uuid,vencimento_original date,plano_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer,completude text)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform pcm.sso_exigir_fontes_capacidade_autorizadas();
  return query select * from pcm.sso_mediar_ocorrencias_sem_os(p_cliente_id,p_semana_inicio,p_apos_tipo,p_apos_id,p_limite);
end; $$;

revoke all on function pcm.sso_fontes_demanda_autorizadas(uuid,date,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_fontes_esforco_autorizadas(uuid,date,uuid,integer) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_ocorrencias_sem_os_autorizadas(uuid,date,text,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_fontes_demanda_autorizadas(uuid,date,uuid,integer),pcm.sso_fontes_esforco_autorizadas(uuid,date,uuid,integer),pcm.sso_ocorrencias_sem_os_autorizadas(uuid,date,text,uuid,integer) to authenticated;
revoke execute on function pcm.sso_mediar_fontes_demanda_visita(uuid,date,uuid,integer),pcm.sso_mediar_fontes_esforco_visita(uuid,date,uuid,integer),pcm.sso_mediar_ocorrencias_sem_os(uuid,date,text,uuid,integer) from public,anon,authenticated,service_role;
