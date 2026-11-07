-- ADR-0769: manter autorização e gates até o término da transação.
create or replace function pcm.sso_ingestao_foto_servico(p_operacao text,p_usuario_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text,p_digest text,p_objeto_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text; v_cliente uuid; v_claims text; v_sub text; v_resultado jsonb; v_gate boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select g.habilitado into v_gate from pcm.sso_ingestao_foto_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
  select g.habilitado into v_gate from pcm.sso_fotos_levantamento_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
  if p_usuario_id is null or p_lote_id is null or p_chave is null or p_operacao is null or p_operacao not in ('autorizar','reservar','confirmar') then raise exception 'sem_acesso' using errcode='42501'; end if;
  select u.papel into v_papel from config.usuarios u where u.user_id=p_usuario_id and u.ativo;
  if v_papel is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_claims:=current_setting('request.jwt.claims',true); v_sub:=current_setting('request.jwt.claim.sub',true);
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',v_papel)::text,true);
  perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l join pcm.sso_levantamento_linhas i on i.lote_id=l.id and i.chave=p_chave where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if p_operacao='autorizar' then v_resultado:='true'::jsonb;
  elsif p_operacao='reservar' then v_resultado:=pcm.sso_reservar_ingestao_foto_interno(p_request_id,p_lote_id,p_chave,p_digest);
  else
    if not exists(select 1 from pcm.sso_ingestao_foto_reservas r where r.request_id=p_request_id and r.ator_id=p_usuario_id and r.lote_id=p_lote_id and r.linha_chave=p_chave and r.cliente_id=v_cliente) then raise exception 'sem_acesso' using errcode='42501'; end if;
    v_resultado:=pcm.sso_confirmar_ingestao_foto_interno(p_request_id,p_digest,p_objeto_id);
  end if;
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return v_resultado;
end; $$;

create or replace function pcm.sso_resolver_foto_digest_servico(p_usuario_id uuid,p_foto_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text; v_claims text; v_sub text; v_res pcm.sso_ingestao_foto_reservas%rowtype; v_resultado jsonb; v_gate boolean;
begin
  if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  select g.habilitado into v_gate from pcm.sso_ingestao_foto_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
  select g.habilitado into v_gate from pcm.sso_fotos_levantamento_gate g where g.id for share;
  if not coalesce(v_gate,false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
  select u.papel into v_papel from config.usuarios u where u.user_id=p_usuario_id and u.ativo;
  if v_papel is null or p_foto_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_claims:=current_setting('request.jwt.claims',true); v_sub:=current_setting('request.jwt.claim.sub',true);
  perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',v_papel)::text,true);
  perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
  select r.* into v_res from pcm.sso_ingestao_foto_reservas r
    join pcm.sso_fotos_levantamento f on f.id=r.foto_id and f.cliente_id=r.cliente_id and f.lote_id=r.lote_id and f.linha_chave=r.linha_chave and f.objeto_id=r.objeto_id
    join storage.objects o on o.id=r.objeto_id and o.name=r.nome and o.bucket_id='sso-levantamento-fotos'
    join storage.buckets b on b.id=o.bucket_id and b.public is false
    where r.foto_id=p_foto_id and r.confirmado_em is not null
      and config.sso_autorizar_acao('cadastro.aprovar',r.cliente_id) is true
      and not exists(select 1 from pcm.sso_retiradas_anexo t where t.tipo='foto' and t.anexo_id=r.foto_id);
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  v_resultado:=jsonb_build_object('objetoId',v_res.objeto_id,'nome',v_res.nome,'digest',v_res.digest);
  perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
  perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
  return v_resultado;
end; $$;
