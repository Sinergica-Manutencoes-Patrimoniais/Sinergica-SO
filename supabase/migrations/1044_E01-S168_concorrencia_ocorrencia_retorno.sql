-- ADR-0856: proteção adicional somente quando o gate de origem estiver ligado.
create function pcm.sso_travar_ocorrencia_calendario_retorno(p_ocorrencia uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'isolamento_origem_incompativel' using errcode='25001';
  end if;
  perform 1 from pcm.ocorrencias_preventivas where id=p_ocorrencia for share;
  if not found then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
end;
$$;
revoke all on function pcm.sso_travar_ocorrencia_calendario_retorno(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_guardar_ocorrencia_com_retorno()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.plano_id is not distinct from old.plano_id
      and new.vencimento is not distinct from old.vencimento then return new; end if;
  perform 1 from pcm.sso_integridade_retorno_calendario_gate where id for share;
  if coalesce((select habilitado from pcm.sso_integridade_retorno_calendario_gate where id),false)
    and exists(select 1 from pcm.ordens_servico os join pcm.retorno_os_preparado r on r.os_id=os.id
      where os.ocorrencia_preventiva_id=old.id) then
    raise exception 'ocorrencia_com_retorno_origem_imutavel' using errcode='23514';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function pcm.sso_guardar_ocorrencia_com_retorno() from public,anon,authenticated,service_role;
create trigger sso_guardar_ocorrencia_com_retorno before delete or update of plano_id,vencimento
on pcm.ocorrencias_preventivas for each row execute function pcm.sso_guardar_ocorrencia_com_retorno();

do $migration$
declare
  v_def text;
  v_old text;
  v_new text;
  v_fun regprocedure;
begin
  for v_fun,v_old,v_new in values
    ('pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb)'::regprocedure,
      '      v_origem := pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);',
      '      perform pcm.sso_travar_ocorrencia_calendario_retorno(v_os.ocorrencia_preventiva_id);' || chr(10) || '      v_origem := pcm.sso_resolver_origem_execucao(p_cliente_id,v_os.ocorrencia_preventiva_id);'),
    ('pcm.sso_registrar_pendencia_retorno(uuid,uuid)'::regprocedure,
      '      v_origem := pcm.sso_resolver_origem_execucao(v_retorno.cliente_id,v_ocorrencia);',
      '      perform pcm.sso_travar_ocorrencia_calendario_retorno(v_ocorrencia);' || chr(10) || '      v_origem := pcm.sso_resolver_origem_execucao(v_retorno.cliente_id,v_ocorrencia);')
  loop
    select pg_catalog.pg_get_functiondef(v_fun) into v_def;
    if position(v_old in v_def)=0 or (length(v_def)-length(replace(v_def,v_old,'')))/length(v_old)<>1 then
      raise exception 'definicao_origem_incompativel: %',v_fun using errcode='55000';
    end if;
    execute replace(v_def,v_old,v_new);
  end loop;
end;
$migration$;
revoke all on function pcm.sso_classificar_retorno_campo_manual(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_registrar_pendencia_retorno(uuid,uuid) from public,anon,authenticated,service_role;
