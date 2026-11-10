-- ADR-1350: confirma identidade, não comprova digest dos bytes armazenados.
create function pcm.sso_recuperar_ingestao_comprovante(
  p_request_id uuid, p_cliente_id uuid, p_visita_id uuid, p_despesa_id uuid, p_digest text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare v_objeto uuid; v_ator uuid := auth.uid();
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode = '25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03'; end if;
  perform 1 from pcm.sso_ingestao_comprovante_gate where id and habilitado for share;
  if not found then raise exception 'ingestao_desabilitada' using errcode = '55000'; end if;
  perform 1 from pcm.sso_upload_comprovante_gate where id and habilitado for share;
  if not found then raise exception 'ingestao_desabilitada' using errcode = '55000'; end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_visita_id is null or p_despesa_id is null
    or p_digest is null or p_digest !~ '^[a-f0-9]{64}$' then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-comprovante:' || p_request_id::text, 0));
  perform 1 from pcm.despesas_visita d where d.id = p_despesa_id and d.cliente_id = p_cliente_id
    and d.visita_id = p_visita_id and d.status = 'ativa' for share;
  if not found or config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is distinct from true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  select c.objeto_id into v_objeto from pcm.sso_ingestao_comprovante_reservas r
    join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id = r.request_id
    join storage.objects o on o.id = c.objeto_id and o.name = r.caminho and o.bucket_id = 'sso-despesas-visita'
    join storage.buckets b on b.id = o.bucket_id and b.public is false
    where r.request_id = p_request_id and r.ator_id = v_ator and r.cliente_id = p_cliente_id
      and r.despesa_id = p_despesa_id and r.digest = p_digest for share of o;
  if config.sso_autorizar_acao('despesa_visita.gerir', p_cliente_id) is distinct from true then
    raise exception 'despesa_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
  return jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'visitaId', p_visita_id,
    'despesaId', p_despesa_id, 'digest', p_digest, 'objetoId', v_objeto, 'integridadeBytesComprovada', false);
end; $$;
revoke all on function pcm.sso_recuperar_ingestao_comprovante(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_recuperar_ingestao_comprovante(uuid,uuid,uuid,uuid,text) to authenticated;
