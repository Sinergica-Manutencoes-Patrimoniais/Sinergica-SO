-- ADR-1127: origem suprimida não pode receber nova ocorrência por outro escritor.
create function pcm.sso_guardar_nova_ocorrencia_visita_suprimida() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_habilitado boolean;v_visita_habilitada boolean;
begin
 if new.visita_id is null then raise exception 'visita_indisponivel' using errcode='23514'; end if;
 select habilitado into v_visita_habilitada from pcm.sso_supressao_visita_preexistente_gate where id for share;
 if not found then raise exception 'supressao_indisponivel' using errcode='55000'; end if;
 select habilitado into v_habilitado from pcm.sso_ocorrencia_visita_suprimivel_gate where id for share;
 if not found then raise exception 'supressao_indisponivel' using errcode='55000'; end if;
 if not v_visita_habilitada and not v_habilitado and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=new.visita_id) then return new; end if;
 perform 1 from pcm.visitas v where v.id=new.visita_id for share nowait;
 if not found then raise exception 'visita_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=new.visita_id) then
  raise exception 'visita_suprimida_sem_nova_ocorrencia' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_nova_ocorrencia_visita_suprimida() from public,anon,authenticated,service_role;
create trigger sso_guardar_nova_ocorrencia_visita_suprimida before insert or update of visita_id on pcm.ocorrencias_visita_preparadas
 for each row execute function pcm.sso_guardar_nova_ocorrencia_visita_suprimida();
