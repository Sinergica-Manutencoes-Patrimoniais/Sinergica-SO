-- ADR-0504: bloqueio persistente para vínculo Visita enquanto consumidores não foram adaptados.
create function pcm.sso_bloquear_consumidor_visita_nao_integrado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_os_id uuid;
begin
 if tg_table_name='decisoes_validacao_os' then select os_id into v_os_id from pcm.retorno_os_preparado where id=new.retorno_id;
 else v_os_id:=new.os_id;end if;
 if v_os_id is not null and exists(select 1 from pcm.ordens_servico os join pcm.sso_vinculos_visita_legado v on v.ocorrencia_legada_id=os.ocorrencia_preventiva_id where os.id=v_os_id and os.client_id=v.cliente_id) then
  raise exception 'origem_visita_consumidores_nao_integrados' using errcode='55000';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_bloquear_consumidor_visita_nao_integrado() from public,anon,authenticated,service_role;
create trigger sso_bloquear_retorno_origem_visita before insert on pcm.retorno_os_preparado for each row execute function pcm.sso_bloquear_consumidor_visita_nao_integrado();
create trigger sso_bloquear_decisao_origem_visita before insert on pcm.decisoes_validacao_os for each row execute function pcm.sso_bloquear_consumidor_visita_nao_integrado();
create trigger sso_bloquear_pendencia_origem_visita before insert on pcm.sso_pendencias_tecnicas for each row execute function pcm.sso_bloquear_consumidor_visita_nao_integrado();
create trigger sso_bloquear_finalizacao_origem_visita before insert on pcm.sso_finalizacoes_os_validadas for each row execute function pcm.sso_bloquear_consumidor_visita_nao_integrado();
