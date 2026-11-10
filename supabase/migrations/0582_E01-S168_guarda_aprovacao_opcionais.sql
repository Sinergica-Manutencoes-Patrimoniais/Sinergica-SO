-- ADR-0356: substituição aditiva da guarda; nenhum dado histórico é alterado.
create or replace function pcm.sso_guardar_cobertura_validacao_os() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_retorno pcm.retorno_os_preparado%rowtype;v_snapshot jsonb;v_rotina jsonb;v_perguntas jsonb;v_total integer;
begin
 if new.decisao<>'aprovar' then return new; end if;
 select * into v_retorno from pcm.retorno_os_preparado where id=new.retorno_id for update;
 if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
 select v.snapshot into v_snapshot from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id
 join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id join pcm.planos_manutencao plano on plano.id=ocorr.plano_id
 join pcm.plano_versoes v on v.id=ocorr.versao_id and v.plano_id=plano.id
 where os.id=v_retorno.os_id and os.client_id=v_retorno.cliente_id and os.deleted_at is null and plano.cliente_id=v_retorno.cliente_id
 and ocorr.versao_id=v_retorno.versao_id and ocorr.rotina_id=v_retorno.rotina_id and v.estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'vinculo_os_versao_nao_comprovado' using errcode='23514'; end if;
 select count(*),min(item::text)::jsonb into v_total,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') as r(item) where item->>'id'=v_retorno.rotina_id::text;
 if v_total<>1 or jsonb_typeof(v_rotina->'questionario') is distinct from 'object' or v_rotina->'questionario'->>'id' is distinct from v_rotina->>'questionario_id' or v_rotina->>'questionario_id' is null then raise exception 'questionario_historico_indisponivel' using errcode='23514'; end if;
 v_perguntas:=v_rotina->'questionario'->'perguntas';
 if jsonb_typeof(v_perguntas) is distinct from 'array' then raise exception 'perguntas_historicas_invalidas' using errcode='23514'; end if;
 if jsonb_array_length(v_perguntas)=0 or exists(select 1 from jsonb_array_elements(v_perguntas) p(item) where jsonb_typeof(p.item) is distinct from 'object' or jsonb_typeof(p.item->'id') not in ('string','number') or nullif(btrim(p.item->>'id'),'') is null)
 or exists(select 1 from jsonb_array_elements(v_perguntas) p(item) group by p.item->>'id' having count(*)>1) then raise exception 'identidade_perguntas_nao_comprovada' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(v_perguntas) p(item)
   where not exists(select 1 from pcm.respostas_os_preparadas resp where resp.retorno_id=new.retorno_id and resp.chave_pergunta=p.item->>'id' and resp.resultado in ('ok','nao_ok','nao_aplicavel','corrigido'))
   and not ((select count(*) from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) c(item)
      where c.item->>'rotinaId'=v_retorno.rotina_id::text and c.item->>'questionarioId'=v_rotina->>'questionario_id' and c.item->>'perguntaId'=p.item->>'id')=1
     and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) c(item)
      where c.item->>'rotinaId'=v_retorno.rotina_id::text and c.item->>'questionarioId'=v_rotina->>'questionario_id' and c.item->>'perguntaId'=p.item->>'id' and jsonb_typeof(c.item->'obrigatoria')='boolean' and c.item->>'obrigatoria'='false')))
 or exists(select 1 from pcm.respostas_os_preparadas resp where resp.retorno_id=new.retorno_id and not exists(select 1 from jsonb_array_elements(v_perguntas) p(item) where p.item->>'id'=resp.chave_pergunta)) then raise exception 'cobertura_nao_comprovada' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_cobertura_validacao_os() from public,anon,authenticated,service_role;
