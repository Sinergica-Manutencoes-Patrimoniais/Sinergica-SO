-- ADR-0336: prévia por pergunta histórica, sem inferir requisitos de foto.
create function pcm.sso_prever_cobertura_perguntas(p_cliente_id uuid,p_retorno_id uuid,p_apos integer,p_limite integer)
returns table(indice integer,pergunta_id text,obrigatorio_declarado boolean,resposta_id uuid,resultado text,decisao_pcm text,revisao_uploads_decisao integer,revisao_uploads_atual integer,estado text)
language plpgsql stable security definer set search_path='' as $$
declare v_retorno pcm.retorno_os_preparado%rowtype;v_snapshot jsonb;v_rotina jsonb;v_perguntas jsonb;v_count integer;v_uploads integer;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_validacao_resposta_gate where id),false) then raise exception 'cobertura_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id;
 if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
 select v.snapshot into v_snapshot from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id join pcm.ocorrencias_rotina_preparadas oc on oc.id=vinc.ocorrencia_preparada_id
 join pcm.planos_manutencao p on p.id=oc.plano_id and p.cliente_id=p_cliente_id join pcm.plano_versoes v on v.id=oc.versao_id and v.plano_id=p.id and v.estado='aprovado'
 where os.id=v_retorno.os_id and os.client_id=p_cliente_id and os.deleted_at is null and oc.versao_id=v_retorno.versao_id and oc.rotina_id=v_retorno.rotina_id;
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'vinculo_nao_comprovado' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_count,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where x.item->>'id'=v_retorno.rotina_id::text;
 if v_count<>1 or jsonb_typeof(v_rotina->'questionario') is distinct from 'object' or v_rotina->'questionario'->>'id' is distinct from v_rotina->>'questionario_id' or v_rotina->>'questionario_id' is null then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
 v_perguntas:=v_rotina->'questionario'->'perguntas';
 if jsonb_typeof(v_perguntas) is distinct from 'array' or jsonb_array_length(v_perguntas)=0 then raise exception 'perguntas_indisponiveis' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(v_perguntas) x(item) where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') not in ('string','number') or nullif(btrim(item->>'id'),'') is null) or exists(select 1 from jsonb_array_elements(v_perguntas) x(item) group by item->>'id' having count(*)>1) then raise exception 'perguntas_invalidas' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_uploads from pcm.sso_uploads_evidencia_resposta where retorno_id=p_retorno_id;
 return query select x.ord::integer,x.item->>'id',case when jsonb_typeof(x.item->'obrigatorio')='boolean' then (x.item->>'obrigatorio')::boolean else null end,r.id,r.resultado,d.decisao,d.revisao_uploads,v_uploads,
 case when r.id is null then 'sem_resposta' when r.resultado='nao_inspecionado' then 'nao_inspecionado' when d.id is null then 'sem_decisao_pcm' when d.revisao_uploads<>v_uploads then 'decisao_com_uploads_desatualizados' when d.decisao='rejeitada_pcm' then 'rejeitada_pcm' else 'aceita_pcm_sem_autenticacao_externa' end
 from jsonb_array_elements(v_perguntas) with ordinality x(item,ord)
 left join pcm.respostas_os_preparadas r on r.retorno_id=p_retorno_id and r.chave_pergunta=x.item->>'id'
 left join lateral (select z.* from pcm.sso_validacoes_resposta z where z.retorno_id=p_retorno_id and z.resposta_id=r.id order by z.revisao desc limit 1) d on true
 where p_apos is null or x.ord>p_apos order by x.ord limit p_limite;
end; $$;
revoke all on function pcm.sso_prever_cobertura_perguntas(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
