-- ADR-1438: a conversão integral usa a mesma autorização transacional da criação simples.
do $migration$
declare
 v_funcao regprocedure := 'pcm.sso_converter_chamado_integral(uuid,bigint,uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
 v_declaracao text := 'v_actor uuid:=auth.uid(); v_c pcm.chamados%rowtype; v_os pcm.ordens_servico%rowtype;';
 v_inicio text := 'insert into pcm.ordens_servico(id,client_id,chamado_id,numero,titulo,descricao,categoria,status,prioridade,gravidade,urgencia,tendencia,dor_cliente,observacao,local_descricao,solicitante,origem,created_by,tipo_tarefa_id,tecnico_funcionario_id,data_agendada,tipo_os,pmoc_schedule_id,origem_inspecao_item_id,equipamento_id,foto_urls)';
 v_fim text := 'update pcm.chamados set ordem_servico_id=coalesce(ordem_servico_id,p_os_id),status=p_destino,updated_at=now(),updated_by=v_actor where id=p_chamado_id returning * into v_c;';
begin
 if length(v_definicao)-length(replace(v_definicao,v_declaracao,''))<>length(v_declaracao)
   or length(v_definicao)-length(replace(v_definicao,v_inicio,''))<>length(v_inicio)
   or length(v_definicao)-length(replace(v_definicao,v_fim,''))<>length(v_fim)
   or strpos(v_definicao,v_inicio)>=strpos(v_definicao,v_fim) then
   raise exception 'definicao_conversao_integral_incompativel' using errcode='55000';
 end if;
 v_definicao:=replace(v_definicao,v_declaracao,v_declaracao || ' v_sync_anterior text;');
 v_definicao:=replace(v_definicao,v_inicio,$trecho$if exists(select 1 from pg_catalog.pg_trigger where tgrelid='pcm.ordens_servico'::regclass
   and tgname='trg_auvo_create_task_on_planejamento' and not tgisinternal and tgenabled<>'D') then
   raise exception 'disparo_auvo_legado_ativo' using errcode='55000'; end if;
 v_sync_anterior:=current_setting('app.auvo_sync_write',true);
 perform pg_catalog.set_config('app.auvo_sync_write','true',true);
 insert into pcm.sso_guarda_multiplas_os_tokens(txid,ator_id,chamado_id,cliente_id,os_id)
   values(pg_catalog.txid_current(),v_actor,p_chamado_id,p_cliente_id,p_os_id);
 $trecho$ || v_inicio);
 v_definicao:=replace(v_definicao,v_fim,$trecho$delete from pcm.sso_guarda_multiplas_os_tokens where txid=pg_catalog.txid_current()
   and ator_id=v_actor and chamado_id=p_chamado_id and cliente_id=p_cliente_id and os_id=p_os_id;
 perform pg_catalog.set_config('app.auvo_sync_write',coalesce(v_sync_anterior,''),true);
 $trecho$ || v_fim);
 execute v_definicao;
end;
$migration$;
