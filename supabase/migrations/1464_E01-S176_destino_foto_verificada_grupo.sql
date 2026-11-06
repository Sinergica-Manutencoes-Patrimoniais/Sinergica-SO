-- ADR-1317: prévia autenticada; não cria vínculo e não retorna caminho/digest.
create function pcm.sso_destino_foto_verificada_grupo(p_ator_id uuid,p_cliente_id uuid,p_foto_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_foto pcm.sso_fotos_levantamento%rowtype;v_grupo uuid;v_total bigint;v_ativo boolean;v_revision integer;v_decisao text;v_confirmada boolean;
begin
 if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_foto_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_foto_verificada_grupo_gate where id and habilitado for share;
 if not found then raise exception 'vinculo_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_ingestao_foto_gate where id and habilitado for share;
 if not found then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.sso_fotos_levantamento_gate where id and habilitado for share;
 if not found then raise exception 'fotos_desabilitadas' using errcode='55000'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_foto from pcm.sso_fotos_levantamento where id=p_foto_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(distinct i.entidade_id) into v_total from pcm.sso_levantamento_incorporacoes i
   where i.lote_id=v_foto.lote_id and i.linha_chave=v_foto.linha_chave and i.tipo='grupo_quantitativo';
 if v_total>1 then raise exception 'destino_ambiguo' using errcode='23514'; end if;
 select i.entidade_id into v_grupo from pcm.sso_levantamento_incorporacoes i
   where i.lote_id=v_foto.lote_id and i.linha_chave=v_foto.linha_chave and i.tipo='grupo_quantitativo' limit 1;
 if v_grupo is not null then
   select g.ativo and g.deleted_at is null into v_ativo from pcm.grupos_quantitativos g where g.id=v_grupo and g.cliente_id=p_cliente_id for share;
   if not found then v_ativo:=false; end if;
 end if;
 select d.revisao,d.decisao into v_revision,v_decisao from pcm.sso_decisoes_foto_levantamento d where d.foto_id=p_foto_id order by d.revisao desc limit 1;
 select exists(select 1 from pcm.sso_ingestao_foto_reservas r where r.foto_id=p_foto_id and r.cliente_id=p_cliente_id
   and r.objeto_id=v_foto.objeto_id and r.confirmado_em is not null) into v_confirmada;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return jsonb_build_object('fotoId',p_foto_id,'grupoId',v_grupo,'grupoAtivo',v_ativo,'revision',coalesce(v_revision,0),
   'decisao',v_decisao,'ingestaoConfirmada',v_confirmada,'inadequada',pcm.sso_foto_inadequada(p_foto_id),
   'retirada',exists(select 1 from pcm.sso_retiradas_anexo where tipo='foto' and anexo_id=p_foto_id),
   'vinculado',exists(select 1 from pcm.sso_foto_verificada_grupo where foto_id=p_foto_id));
end; $$;
revoke all on function pcm.sso_destino_foto_verificada_grupo(uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_destino_foto_verificada_grupo(uuid,uuid,uuid) to authenticated;
