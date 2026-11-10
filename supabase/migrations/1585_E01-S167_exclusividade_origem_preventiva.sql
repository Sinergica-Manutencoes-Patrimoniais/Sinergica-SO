-- ADR-1442: impede OS paralela à origem de um Chamado preventivo conhecido.
create function pcm.sso_guardar_os_legada_chamado_preventivo() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_chamados uuid[];
begin
 if new.ocorrencia_preventiva_id is null then return new; end if;
 select array_agg(distinct chamado_id) into v_chamados from (
   select ch.chamado_id from pcm.ocorrencias_rotina_vinculos ponte
    join pcm.sso_ciclo_calendario_versoes cv on cv.preparada_id=ponte.ocorrencia_preparada_id
    join pcm.sso_chamados_ciclo_preventivo ch on ch.ciclo_id=cv.ciclo_id
    where ponte.ocorrencia_legada_id=new.ocorrencia_preventiva_id
   union all
   select ch.chamado_id from pcm.sso_vinculos_visita_legado ponte
    join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=ponte.ocorrencia_visita_id
    join pcm.sso_chamados_ciclo_visita ch on ch.ciclo_id=cv.ciclo_id
    where ponte.ocorrencia_legada_id=new.ocorrencia_preventiva_id
 ) fontes;
 if coalesce(cardinality(v_chamados),0)>1 then raise exception 'origem_preventiva_ambigua' using errcode='23514'; end if;
 if cardinality(v_chamados)=1 and new.chamado_id is distinct from v_chamados[1] then
   raise exception 'chamado_preventivo_existente_exige_vinculo' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_os_legada_chamado_preventivo() from public,anon,authenticated,service_role;
create trigger sso_guardar_os_legada_chamado_preventivo before insert or update of ocorrencia_preventiva_id,chamado_id
 on pcm.ordens_servico for each row execute function pcm.sso_guardar_os_legada_chamado_preventivo();

create function pcm.sso_guardar_grupo_chamado_preventivo() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_chamados uuid[];v_chamado_os uuid;
begin
 select array_agg(distinct chamado_id) into v_chamados from (
   select ch.chamado_id from pcm.sso_ocorrencias_grupo g
    join pcm.sso_ciclo_calendario_versoes cv on cv.preparada_id=g.calendario_preparado_id
    join pcm.sso_chamados_ciclo_preventivo ch on ch.ciclo_id=cv.ciclo_id where g.id=new.ocorrencia_grupo_id
   union all
   select ch.chamado_id from pcm.sso_ocorrencias_grupo g
    join pcm.sso_ciclo_visita_versoes cv on cv.preparada_id=g.visita_preparada_id
    join pcm.sso_chamados_ciclo_visita ch on ch.ciclo_id=cv.ciclo_id where g.id=new.ocorrencia_grupo_id
 ) fontes;
 if coalesce(cardinality(v_chamados),0)>1 then raise exception 'origem_preventiva_ambigua' using errcode='23514'; end if;
 if cardinality(v_chamados)=1 then
   select chamado_id into v_chamado_os from pcm.ordens_servico where id=new.os_id and client_id=new.cliente_id for share;
   if not found or v_chamado_os is distinct from v_chamados[1] then raise exception 'chamado_preventivo_existente_exige_vinculo' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_grupo_chamado_preventivo() from public,anon,authenticated,service_role;
create trigger sso_guardar_grupo_chamado_preventivo before insert on pcm.sso_vinculos_os_grupo
 for each row execute function pcm.sso_guardar_grupo_chamado_preventivo();
