-- ADR-0343: leitura exclusiva do contrato congelado; sem fallback atual.
create function pcm.sso_prever_cobertura_perguntas_contrato(p_cliente_id uuid,p_retorno_id uuid,p_apos integer,p_limite integer)
returns table(indice integer,pergunta_id text,obrigatoriedade text,resposta_id uuid,resultado text,decisao_pcm text,revisao_uploads_decisao integer,revisao_uploads_atual integer,estado text)
language plpgsql stable security definer set search_path='' as $$
declare v_retorno pcm.retorno_os_preparado%rowtype;v_snapshot jsonb;v_rotina jsonb;v_num integer;v_questionario text;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_validacao_resposta_gate where id),false) then raise exception 'cobertura_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id;
 if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
 select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id and p.cliente_id=p_cliente_id where v.id=v_retorno.versao_id and v.estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where x.item->>'id'=v_retorno.rotina_id::text;
 if v_num<>1 then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
 v_questionario:=v_rotina->>'questionario_id';
 return query select c.indice,c.pergunta_id,case when cont.quantidade=1 and cont.questionario=v_questionario and cont.tipo='boolean' then case when cont.valor='true' then 'obrigatoria' else 'opcional' end else 'indeterminada' end,
 c.resposta_id,c.resultado,c.decisao_pcm,c.revisao_uploads_decisao,c.revisao_uploads_atual,c.estado
 from pcm.sso_prever_cobertura_perguntas(p_cliente_id,p_retorno_id,p_apos,p_limite) c
 cross join lateral (select count(*) quantidade,min(x.item->>'questionarioId') questionario,min(jsonb_typeof(x.item->'obrigatoria')) tipo,min(x.item->>'obrigatoria') valor
  from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) x(item)
  where x.item->>'rotinaId'=v_retorno.rotina_id::text and x.item->>'perguntaId'=c.pergunta_id) cont order by c.indice;
end; $$;
revoke all on function pcm.sso_prever_cobertura_perguntas_contrato(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
