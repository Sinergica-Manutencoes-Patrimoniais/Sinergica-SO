-- ADR-1443: uma OS de Grupo pode compartilhar a origem de seu ciclo no Chamado.
create function pcm.sso_chamado_ciclo_grupo(p_cliente_id uuid,p_grupo_ocorrencia_id uuid)
returns uuid language plpgsql stable security definer set search_path='' as $$
declare v_ids uuid[];
begin
 select array_agg(distinct chamado_id) into v_ids from (
   select ch.chamado_id from pcm.sso_ocorrencias_grupo g
    join pcm.sso_ciclo_calendario_versoes cv on cv.preparada_id=g.calendario_preparado_id
    join pcm.sso_chamados_ciclo_preventivo ch on ch.ciclo_id=cv.ciclo_id and ch.cliente_id=g.cliente_id and ch.plano_id=g.plano_id
    where g.id=p_grupo_ocorrencia_id and g.cliente_id=p_cliente_id
   union all
   select ch.chamado_id from pcm.sso_ocorrencias_grupo g
    join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=g.visita_preparada_id
    join pcm.sso_chamados_ciclo_visita ch on ch.ciclo_id=cv.ciclo_id and ch.cliente_id=g.cliente_id and ch.plano_id=g.plano_id
    where g.id=p_grupo_ocorrencia_id and g.cliente_id=p_cliente_id
 ) fontes;
 if coalesce(cardinality(v_ids),0)>1 then raise exception 'origem_preventiva_ambigua' using errcode='23514'; end if;
 return v_ids[1];
end; $$;
revoke all on function pcm.sso_chamado_ciclo_grupo(uuid,uuid) from public,anon,authenticated,service_role;

do $migration$
declare v_def text; v_antigo text; v_novo text;
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_decidir_vinculo_intencao_grupo(uuid,uuid,uuid,uuid,text)'::regprocedure);
 v_antigo:='and chamado_id is null and ocorrencia_preventiva_id is null for share;';
 v_novo:='and (chamado_id is null or chamado_id=pcm.sso_chamado_ciclo_grupo(p_cliente_id,v_intencao.ocorrencia_grupo_id)) and ocorrencia_preventiva_id is null for share;';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'definicao_decisao_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);

 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_declarar_vinculo_os_grupo(uuid,uuid,uuid,uuid,text)'::regprocedure);
 v_antigo:='if v_os.ocorrencia_preventiva_id is not null or v_os.chamado_id is not null then';
 v_novo:='if v_os.ocorrencia_preventiva_id is not null or (v_os.chamado_id is not null and v_os.chamado_id is distinct from pcm.sso_chamado_ciclo_grupo(p_cliente_id,p_ocorrencia_id)) then';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'definicao_vinculo_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);

 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_criar_os_grupo(uuid,uuid,uuid)'::regprocedure);
 v_antigo:='v_os uuid; v_payload jsonb; v_resultado jsonb; v_sync_anterior text;';
 v_novo:=v_antigo||' v_chamado uuid; v_numero text;';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'definicao_criacao_grupo_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,v_antigo,v_novo);
 v_antigo:='v_os:=gen_random_uuid();';
 v_novo:=$novo$v_os:=gen_random_uuid();
 v_chamado:=pcm.sso_chamado_ciclo_grupo(p_cliente_id,v_oc.id);
 if v_chamado is not null then
   if config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
   perform 1 from pcm.sso_guarda_multiplas_os_gate where id and habilitado for share;
   if not found or pg_catalog.to_regclass('pcm.uq_ordens_servico_chamado') is not null
     or exists(select 1 from pg_catalog.pg_trigger where tgrelid='pcm.ordens_servico'::regclass and tgname='trg_ordens_servico_numero_chamado' and not tgisinternal) then
     raise exception 'transicao_legada_incompleta' using errcode='55000'; end if;
   select numero into v_numero from pcm.chamados where id=v_chamado and cliente_id=p_cliente_id and deleted_at is null and status in ('aberto','convertido_os') for update;
   if not found then raise exception 'chamado_indisponivel' using errcode='23514'; end if;
   insert into pcm.sso_guarda_multiplas_os_tokens(txid,ator_id,chamado_id,cliente_id,os_id) values(pg_catalog.txid_current(),v_ator,v_chamado,p_cliente_id,v_os);
   v_numero:=v_numero||'-OS-'||v_os::text;
 else v_numero:='PRE-'||upper(replace(v_os::text,'-','')); end if;$novo$;
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'definicao_criacao_grupo_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,v_antigo,v_novo);
 v_antigo:='insert into pcm.ordens_servico(id,numero,client_id,titulo,descricao,categoria,status,prioridade,origem,created_by,tipo_os,tipo_tarefa_id,questionario_id)';
 v_novo:='insert into pcm.ordens_servico(id,numero,client_id,chamado_id,titulo,descricao,categoria,status,prioridade,origem,created_by,tipo_os,tipo_tarefa_id,questionario_id)';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'definicao_criacao_grupo_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,v_antigo,v_novo);
 v_antigo:=$antigo$values(v_os,'PRE-'||upper(replace(v_os::text,'-','')),p_cliente_id,v_int.titulo,$antigo$;
 v_novo:='values(v_os,v_numero,p_cliente_id,v_chamado,v_int.titulo,';
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'definicao_criacao_grupo_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,v_antigo,v_novo);
 v_antigo:='perform pcm.sso_decidir_vinculo_intencao_grupo(gen_random_uuid(),p_cliente_id,p_intencao_id,v_os,v_int.motivo);';
 v_novo:=$novo$delete from pcm.sso_guarda_multiplas_os_tokens where txid=pg_catalog.txid_current() and ator_id=v_ator and chamado_id=v_chamado and cliente_id=p_cliente_id and os_id=v_os;
 $novo$||v_antigo;
 if length(v_def)-length(replace(v_def,v_antigo,''))<>length(v_antigo) then raise exception 'definicao_criacao_grupo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
