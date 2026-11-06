-- ADR-1450: conferência e reatestação reconhecem a fotografia de Grupo vinculada.
do $migration$
declare v_def text;v_inicio text;v_fim text;v_novo text;
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_conferir_cobertura_retorno(uuid,uuid,uuid,uuid,integer,text)'::regprocedure);
 v_inicio:=' select v.snapshot into v_snapshot from pcm.retorno_campo_classificacoes cl';
 v_fim:=' where cl.retorno_id=p_retorno_id and not exists(select 1 from pcm.origem_campo_resolucoes newer where newer.envelope_id=i.id and (newer.criada_em,newer.id)>(res.criada_em,res.id));';
 if length(v_def)-length(replace(v_def,v_inicio,''))<>length(v_inicio) or length(v_def)-length(replace(v_def,v_fim,''))<>length(v_fim) or strpos(v_def,v_inicio)>=strpos(v_def,v_fim) then raise exception 'conferencia_definicao_incompativel' using errcode='55000'; end if;
 v_novo:=$novo$ if exists(select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_retorno.os_id and vg.cliente_id=p_cliente_id) then
  perform pcm.sso_tentar_coordenar_os_grupo(v_retorno.os_id);
  select v.snapshot into v_snapshot from pcm.retorno_campo_classificacoes cl
   join pcm.origem_campo_inbox i on i.id=cl.envelope_id and i.integracao='auvo'
   join pcm.origem_campo_resolucoes res on res.id=cl.resolucao_id and res.envelope_id=i.id and res.cliente_id=p_cliente_id and res.resultado='os_identificada'
   join pcm.ordens_servico os on os.id=v_retorno.os_id and os.id=res.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.auvo_task_id=i.task_id and os.ocorrencia_preventiva_id is null
   join pcm.clientes cli on cli.id=p_cliente_id and cli.deleted_at is null and cli.auvo_id::text=i.cliente_externo_id
   join pcm.sso_vinculos_os_grupo vg on vg.os_id=os.id and vg.cliente_id=p_cliente_id
   join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=p_cliente_id and og.versao_id=v_retorno.versao_id and og.rotina_id=v_retorno.rotina_id
   join pcm.planos_manutencao p on p.id=og.plano_id and p.cliente_id=p_cliente_id
   join pcm.plano_versoes v on v.id=og.versao_id and v.plano_id=p.id and v.estado='aprovado'
   where cl.retorno_id=p_retorno_id and (os.chamado_id is null or os.chamado_id=pcm.sso_chamado_ciclo_grupo(p_cliente_id,og.id))
    and not exists(select 1 from pcm.origem_campo_resolucoes newer where newer.envelope_id=i.id and (newer.criada_em,newer.id)>(res.criada_em,res.id))
    and (select count(*) from jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text and item->>'alvo_tipo'='grupo' and item->>'grupo_id'=og.grupo_id::text)=1
    and (select count(*) from jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text)=1
   for share of i,res,os,cli,vg,og,p,v;
 else
 $novo$||v_inicio;
 v_def:=replace(v_def,v_inicio,v_novo);
 v_def:=replace(v_def,v_fim,v_fim||chr(10)||' end if;');
 execute v_def;

 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_reatestar_cobertura_retorno(uuid,uuid,uuid,uuid,integer,integer,text)'::regprocedure);
 v_inicio:=' perform r.id from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id order by r.id for share;';
 v_novo:=$novo$ perform og.id from pcm.sso_vinculos_os_grupo vg join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=vg.cliente_id
  join pcm.planos_manutencao p on p.id=og.plano_id and p.cliente_id=vg.cliente_id join pcm.plano_versoes v on v.id=og.versao_id and v.plano_id=p.id
  where vg.os_id=v_retorno.os_id and vg.cliente_id=p_cliente_id and og.versao_id=v_retorno.versao_id and og.rotina_id=v_retorno.rotina_id for share of vg,og,p,v;
 $novo$||v_inicio;
 if length(v_def)-length(replace(v_def,v_inicio,''))<>length(v_inicio) then raise exception 'reatestacao_definicao_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_inicio,v_novo);
end;
$migration$;
revoke all on function pcm.sso_conferir_cobertura_retorno(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_reatestar_cobertura_retorno(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;
