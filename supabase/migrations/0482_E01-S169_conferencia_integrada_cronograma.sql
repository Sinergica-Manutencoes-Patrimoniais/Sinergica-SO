-- ADR-0256: diagnóstico por linha e comando fail-closed; sem incorporação.
create function pcm.sso_conferir_linhas_cronograma(p_cliente_id uuid,p_lote_id uuid,p_apos text,p_limite integer)
returns table(chave text,tipo_linha text,conferencia text,identidade text,mapeamento_id uuid,situacao text,pendencias text[])
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%') then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 return query select l.chave,c.tipo_linha,c.conferencia,i.identidade,m.id,r.estado,
  array_remove(array[
    case when c.id is null then 'classificacao_ausente' end,
    case when c.id is not null and c.conferencia<>'concluida' then 'conferencia_pendente' end,
    case when c.conferencia='concluida' and greatest(coalesce(i.revisao_lote,0),coalesce(m.revisao_lote,0),coalesce(r.revisao_lote,0))>c.revisao_lote then 'conferencia_desatualizada' end,
    case when c.tipo_linha='dado' and r.estado is distinct from 'rejeitada' and i.id is null then 'identidade_ausente' end,
    case when c.tipo_linha='dado' and r.estado is distinct from 'rejeitada' and m.id is null then 'mapeamento_ausente' end
  ]::text[],null)
 from pcm.sso_levantamento_linhas l
 left join lateral (select x.* from pcm.sso_cronograma_classificacoes_linha x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) c on true
 left join lateral (select x.* from pcm.sso_cronograma_identidades_linha x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) i on true
 left join lateral (select x.* from pcm.sso_cronograma_mapeamentos x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) m on true
 left join lateral (select x.* from pcm.sso_cronograma_revisoes_linha x where x.lote_id=l.lote_id and x.chave_linha=l.chave order by x.revisao_lote desc limit 1) r on true
 where l.lote_id=p_lote_id and l.tipo='cronograma' and (p_apos is null or l.chave>p_apos) order by l.chave limit p_limite;
end; $$;
revoke all on function pcm.sso_conferir_linhas_cronograma(uuid,uuid,text,integer) from public,anon,authenticated,service_role;

create function pcm.sso_aprovar_lote_cronograma_preparado(p_request_id uuid,p_cliente_id uuid,p_lote_id uuid,p_expected_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_levantamentos l where l.id=p_lote_id and l.cliente_id=p_cliente_id and l.origem='planilha' and l.chave_origem like 'cronograma:%') then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 raise exception 'aprovacao_cronograma_nao_homologada' using errcode='55000';
end; $$;
revoke all on function pcm.sso_aprovar_lote_cronograma_preparado(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
