-- ADR-1320: leitura da declaração congelada, sem inferir dados legados.
create function pcm.sso_natureza_alvo_aprovada(
  p_ator_id uuid,p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid
) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_snapshot jsonb;v_origens jsonb;v_rotina jsonb;v_natureza text;v_alvo uuid;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null
    then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0))
    then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_natureza_alvo_rotina_gate where id and habilitado for share;
  if not found then raise exception 'natureza_desabilitada' using errcode='55000'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select v.snapshot into v_snapshot from pcm.plano_versoes v
    join pcm.planos_manutencao p on p.id=v.plano_id and p.cliente_id=p_cliente_id
    where v.id=p_versao_id and v.plano_id=p_plano_id and v.estado='aprovado' for share of p,v;
  if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
  select jsonb_agg(r) into v_origens from jsonb_array_elements(v_snapshot->'rotinas') r where r->>'id'=p_rotina_id::text;
  if v_origens is null or jsonb_array_length(v_origens)<>1 then raise exception 'rotina_historica_indisponivel' using errcode='23514'; end if;
  v_rotina:=v_origens->0;
  if v_rotina->>'alvo_tipo' is distinct from 'componente' then raise exception 'alvo_incompativel' using errcode='23514'; end if;
  v_alvo:=(v_rotina->>'equipamento_id')::uuid;v_natureza:=v_rotina->>'natureza_tecnica';
  if v_alvo is null or (v_natureza is not null and v_natureza not in ('equipamento','componente'))
    then raise exception 'snapshot_invalido' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return jsonb_build_object('planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,
    'alvoId',v_alvo,'natureza',v_natureza);
end; $$;
revoke all on function pcm.sso_natureza_alvo_aprovada(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_natureza_alvo_aprovada(uuid,uuid,uuid,uuid,uuid) to authenticated;
