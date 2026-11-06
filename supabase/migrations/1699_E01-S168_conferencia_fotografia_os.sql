-- ADR-1555: confere resolução real e snapshot imutável da OS fotografada.
do $migration$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_conferir_cobertura_retorno(uuid,uuid,uuid,uuid,integer,text)'::regprocedure);
 a text:=$a$ if exists(select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_retorno.os_id and vg.cliente_id=p_cliente_id) then$a$;
 b text:=$b$ if exists(select 1 from pcm.sso_origens_os_preventiva foto where foto.os_id=v_retorno.os_id) then
  select foto.snapshot into v_snapshot from pcm.retorno_campo_classificacoes cl
   join pcm.origem_campo_inbox i on i.id=cl.envelope_id and i.integracao='auvo'
   join pcm.origem_campo_resolucoes res on res.id=cl.resolucao_id and res.envelope_id=i.id and res.cliente_id=p_cliente_id and res.resultado='os_identificada'
   join pcm.ordens_servico os on os.id=v_retorno.os_id and os.id=res.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.auvo_task_id=i.task_id
   join pcm.clientes cli on cli.id=p_cliente_id and cli.deleted_at is null and cli.auvo_id::text=i.cliente_externo_id
   join pcm.sso_origens_os_preventiva foto on foto.os_id=os.id and foto.cliente_id=p_cliente_id and foto.versao_id=v_retorno.versao_id and foto.rotina_id=v_retorno.rotina_id
   join pcm.planos_manutencao plano on plano.id=foto.plano_id and plano.cliente_id=p_cliente_id
   where cl.retorno_id=p_retorno_id and not exists(select 1 from pcm.origem_campo_resolucoes newer where newer.envelope_id=i.id and (newer.criada_em,newer.id)>(res.criada_em,res.id))
    and ((foto.tipo='calendario' and exists(select 1 from pcm.ocorrencias_rotina_preparadas o where o.id=foto.preparada_id and o.plano_id=foto.plano_id and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(foto.snapshot->'rotinas')='array' then foto.snapshot->'rotinas' else '[]'::jsonb end) r(item) where r.item->>'id'=foto.rotina_id::text and r.item->>'rotina_logica_id'=o.rotina_logica_id::text and r.item->>'modo'='calendario' and r.item->>'alvo_tipo'=o.alvo_tipo and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id',r.item->>'grupo_id')=o.alvo_id::text)))
      or (foto.tipo='visita' and exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.id=foto.preparada_id and o.plano_id=foto.plano_id and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(foto.snapshot->'rotinas')='array' then foto.snapshot->'rotinas' else '[]'::jsonb end) r(item) where r.item->>'id'=foto.rotina_id::text and r.item->>'rotina_logica_id'=o.rotina_logica_id::text and r.item->>'modo'='visita' and r.item->>'alvo_tipo'=o.alvo_tipo and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id',r.item->>'grupo_id')=o.alvo_id::text))))
   for share of i,res,os,cli,plano;
 elsif exists(select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_retorno.os_id and vg.cliente_id=p_cliente_id) then$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'conferencia_fotografia_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migration$;
revoke all on function pcm.sso_conferir_cobertura_retorno(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
