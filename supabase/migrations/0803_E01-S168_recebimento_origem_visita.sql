-- ADR-0578: prepara classificação para origem Visita sem liberar escrita ou validação.
-- A barreira de inserção da migration 0729 permanece inalterada.
do $migration$
declare
  v_def text;
  v_antigo text := $old$  select ocorr.* into v_ocorrencia from pcm.ocorrencias_rotina_vinculos vinc
    join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id
    join pcm.planos_manutencao plano on plano.id=ocorr.plano_id and plano.cliente_id=p_cliente_id
    where vinc.ocorrencia_legada_id=v_os.ocorrencia_preventiva_id;
  if not found then raise exception 'vinculo_ocorrencia_nao_comprovado' using errcode='23514'; end if;$old$;
  v_novo text := $new$  if exists (select 1 from pcm.sso_vinculos_visita_legado vinc
      where vinc.ocorrencia_legada_id=v_os.ocorrencia_preventiva_id and vinc.cliente_id=p_cliente_id) then
    -- Resolver comprova vínculo exclusivo, Cliente, alvo e snapshot aprovado.
    v_origem := pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);
    if v_origem->>'tipo' is distinct from 'visita' then
      raise exception 'origem_visita_nao_comprovada' using errcode='23514';
    end if;
    v_ocorrencia.plano_id := (v_origem->>'planoId')::uuid;
    v_ocorrencia.versao_id := (v_origem->>'versaoId')::uuid;
    v_ocorrencia.rotina_id := (v_origem->>'rotinaId')::uuid;
  else
    select ocorr.* into v_ocorrencia from pcm.ocorrencias_rotina_vinculos vinc
      join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id
      join pcm.planos_manutencao plano on plano.id=ocorr.plano_id and plano.cliente_id=p_cliente_id
      where vinc.ocorrencia_legada_id=v_os.ocorrencia_preventiva_id;
    if not found then raise exception 'vinculo_ocorrencia_nao_comprovado' using errcode='23514'; end if;
  end if;$new$;
begin
  select pg_catalog.pg_get_functiondef('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure) into v_def;
  if position(v_antigo in v_def)=0 or position('  v_snapshot jsonb; v_rotina jsonb;' in v_def)=0 then
    raise exception 'classificacao_manual_definicao_incompativel' using errcode='55000';
  end if;
  v_def := replace(v_def,'  v_snapshot jsonb; v_rotina jsonb;','  v_origem jsonb; v_snapshot jsonb; v_rotina jsonb;');
  v_def := replace(v_def,v_antigo,v_novo);
  execute v_def;
end;
$migration$;

revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
