-- ADR-0678: prepara classificador e fecha consumidores para associação Grupo.
create or replace function pcm.sso_bloquear_consumidor_visita_nao_integrado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_os_id uuid;
begin
 if tg_table_name='decisoes_validacao_os' then select os_id into v_os_id from pcm.retorno_os_preparado where id=new.retorno_id;
 else v_os_id:=new.os_id; end if;
 if v_os_id is not null and (exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_visita_legado v on v.ocorrencia_legada_id=os.ocorrencia_preventiva_id where os.id=v_os_id and os.client_id=v.cliente_id)
   or exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_os_grupo v on v.os_id=os.id and v.cliente_id=os.client_id where os.id=v_os_id)) then
   raise exception 'origem_consumidores_nao_integrados' using errcode='55000';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_bloquear_consumidor_visita_nao_integrado() from public,anon,authenticated,service_role;
do $migration$
declare v_def text;v_antigo text;
 v_novo text:=$new$  if exists (select 1 from pcm.sso_vinculos_os_grupo vg where vg.os_id=v_os.id and vg.cliente_id=p_cliente_id) then
    select og.plano_id,og.versao_id,og.rotina_id into v_ocorrencia.plano_id,v_ocorrencia.versao_id,v_ocorrencia.rotina_id
    from pcm.sso_vinculos_os_grupo vg join pcm.sso_ocorrencias_grupo og on og.id=vg.ocorrencia_grupo_id and og.cliente_id=vg.cliente_id
    join pcm.planos_manutencao plano on plano.id=og.plano_id and plano.cliente_id=vg.cliente_id
    join pcm.plano_versoes versao on versao.id=og.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
    where vg.os_id=v_os.id and vg.cliente_id=p_cliente_id and v_os.ocorrencia_preventiva_id is null and v_os.chamado_id is null
      and jsonb_typeof(versao.snapshot->'rotinas')='array'
      and (select count(*) from jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text and item->>'alvo_tipo'='grupo' and item->>'grupo_id'=og.grupo_id::text)=1
      and (select count(*) from jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) x(item) where item->>'id'=og.rotina_id::text)=1;
    if not found then raise exception 'origem_grupo_indisponivel' using errcode='23514'; end if;
  elsif exists (select 1 from pcm.sso_vinculos_visita_legado vinc$new$;
begin
 -- Sem depender de formatação externa ao trecho exato da 0803.
 v_antigo:='  if exists (select 1 from pcm.sso_vinculos_visita_legado vinc';
 select pg_catalog.pg_get_functiondef('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure) into v_def;
 if position(v_antigo in v_def)=0 then raise exception 'classificador_definicao_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antigo,v_novo);
end;
$migration$;
revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
