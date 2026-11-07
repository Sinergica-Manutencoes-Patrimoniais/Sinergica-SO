-- ADR-0742: a decisão atual e os gates permanecem protegidos até o fim da transação.
create or replace function pcm.sso_vincular_foto_levantamento_autorizado(p_request_id uuid,p_lote_id uuid,p_chave text,p_nome text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_cliente uuid; v_gate boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select g.habilitado into v_gate from pcm.sso_mediacao_conferencia_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  select g.habilitado into v_gate from pcm.sso_fotos_levantamento_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return pcm.sso_vincular_foto_levantamento(p_request_id,p_lote_id,p_chave,p_nome);
end; $$;

create or replace function pcm.sso_recibo_foto_levantamento_autorizado(p_request_id uuid,p_lote_id uuid,p_chave text,p_nome text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_cliente uuid; v_foto uuid; v_gate boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select g.habilitado into v_gate from pcm.sso_mediacao_conferencia_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  select g.habilitado into v_gate from pcm.sso_fotos_levantamento_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
  if auth.uid() is null or p_request_id is null or p_lote_id is null or p_chave is null or p_nome is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select f.id into v_foto from pcm.sso_fotos_levantamento f join storage.objects o on o.id=f.objeto_id and o.bucket_id='sso-levantamento-fotos'
    where f.request_id=p_request_id and f.ator_id=auth.uid() and f.cliente_id=v_cliente and f.lote_id=p_lote_id and f.linha_chave=p_chave and o.name=p_nome;
  if v_foto is null then return null; end if;
  return jsonb_build_object('fotoId',v_foto,'loteId',p_lote_id,'chave',p_chave,'requestId',p_request_id);
end; $$;
