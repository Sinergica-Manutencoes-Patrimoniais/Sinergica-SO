-- ADR-0252: diagnóstico somente; não aprova e não cria Rotinas.
create function pcm.sso_diagnosticar_aprovacao_cronograma(p_cliente_id uuid,p_lote_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype; v_total integer; v_identificadas integer; v_mapeadas integer; v_rejeitadas integer; v_revisao integer;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 select * into v_lote from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%';
 if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 select count(*) into v_total from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.tipo='cronograma';
 select count(distinct i.chave_linha) into v_identificadas from pcm.sso_cronograma_identidades_linha i where i.lote_id=p_lote_id;
 select count(distinct m.chave_linha) into v_mapeadas from pcm.sso_cronograma_mapeamentos m where m.lote_id=p_lote_id;
 select count(*) filter(where x.estado='rejeitada'),count(*) filter(where x.estado='em_revisao') into v_rejeitadas,v_revisao
 from (select distinct on(r.chave_linha) r.chave_linha,r.estado from pcm.sso_cronograma_revisoes_linha r where r.lote_id=p_lote_id order by r.chave_linha,r.revisao_lote desc) x;
 return jsonb_build_object('loteId',p_lote_id,'revision',v_lote.revisao,'linhasBrutas',v_total,'linhasComIdentidade',v_identificadas,'linhasComMapeamento',v_mapeadas,
  'linhasRejeitadas',v_rejeitadas,'linhasEmRevisao',v_revisao,'aprovacaoDisponivel',false,
  'impedimentos',jsonb_build_array('linhas_incluem_cabecalhos_sem_classificacao_confiavel','conferencia_conclusiva_nao_disponivel','politica_e_autorizacao_de_aprovacao_nao_verificadas','incorporacao_e_idempotencia_operacional_nao_homologadas'));
end; $$;
revoke all on function pcm.sso_diagnosticar_aprovacao_cronograma(uuid,uuid) from public,anon,authenticated,service_role;
