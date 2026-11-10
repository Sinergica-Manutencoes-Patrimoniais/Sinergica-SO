-- ADR-0666: mesmo texto histórico, com resolvedor privado para origem Visita.
create or replace function pcm.sso_descricao_historica_pendencia(p_cliente_id uuid,p_pendencia_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_total bigint;v_texto text;v_tipo_valido boolean;
begin
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*),min(q.item->>'texto'),bool_and(jsonb_typeof(q.item->'texto')='string') into v_total,v_texto,v_tipo_valido
 from pcm.sso_pendencias_tecnicas p
 join pcm.respostas_os_preparadas resp on resp.id=p.resposta_id and resp.retorno_id=p.retorno_id and resp.chave_pergunta=p.pergunta
 join pcm.retorno_os_preparado ret on ret.id=p.retorno_id and ret.os_id=p.os_id and ret.rotina_id=p.rotina_id and ret.cliente_id=p_cliente_id
 join pcm.ordens_servico os on os.id=p.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.ocorrencia_preventiva_id=p.ocorrencia_id
 cross join lateral (select case when exists(select 1 from pcm.sso_vinculos_visita_legado vv where vv.ocorrencia_legada_id=p.ocorrencia_id and vv.cliente_id=p_cliente_id) then pcm.sso_resolver_origem_execucao(p_cliente_id,p.ocorrencia_id) else null::jsonb end as dados) origem
 left join pcm.ocorrencias_rotina_vinculos vinc on origem.dados is null and vinc.ocorrencia_legada_id=p.ocorrencia_id
 left join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id and ocorr.rotina_id=ret.rotina_id and ocorr.versao_id=ret.versao_id
 join pcm.planos_manutencao plano on plano.cliente_id=p_cliente_id and ((origem.dados is null and plano.id=ocorr.plano_id) or (origem.dados->>'tipo'='visita' and plano.id=(origem.dados->>'planoId')::uuid and origem.dados->>'versaoId'=ret.versao_id::text and origem.dados->>'rotinaId'=ret.rotina_id::text))
 join pcm.plano_versoes versao on versao.id=ret.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
 cross join lateral jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) r(item)
 cross join lateral jsonb_array_elements(case when jsonb_typeof(r.item->'questionario'->'perguntas')='array' then r.item->'questionario'->'perguntas' else '[]'::jsonb end) q(item)
 where p.id=p_pendencia_id and p.cliente_id=p_cliente_id and r.item->>'id'=ret.rotina_id::text
 and (select count(*) from jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) ri(item) where ri.item->>'id'=ret.rotina_id::text)=1
 and jsonb_typeof(r.item->'questionario')='object' and r.item->'questionario'->>'id'=r.item->>'questionario_id' and q.item->>'id'=resp.chave_pergunta;
 if v_total<>1 or v_tipo_valido is distinct from true or nullif(btrim(v_texto),'') is null or length(btrim(v_texto))>1000 then raise exception 'descricao_historica_indisponivel_ou_ambigua' using errcode='23514'; end if;
 return btrim(v_texto);
end; $$;
revoke all on function pcm.sso_descricao_historica_pendencia(uuid,uuid) from public,anon,authenticated,service_role;
