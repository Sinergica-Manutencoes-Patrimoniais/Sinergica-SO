-- ADR-1380: prepara guarda de vínculos sem liberar supressão de Grupo.
create table pcm.sso_proteger_grupo_suprimido_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_proteger_grupo_suprimido_gate(id,habilitado) values(true,false);
alter table pcm.sso_proteger_grupo_suprimido_gate enable row level security;
alter table pcm.sso_proteger_grupo_suprimido_gate force row level security;
revoke all on pcm.sso_proteger_grupo_suprimido_gate from public,anon,authenticated,service_role;

create function pcm.sso_guardar_dependencia_grupo_suprimido() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_grupo uuid; v_preparada uuid; v_visita uuid; v_habilitado boolean;
begin
 if tg_argv[0] not in ('ocorrencia_grupo_id','ocorrencia_id','intencao_id') then raise exception 'configuracao_invalida' using errcode='22023'; end if;
 if tg_argv[0]='intencao_id' then
   select i.ocorrencia_grupo_id into v_grupo from pcm.sso_intencoes_os_grupo i where i.id=(to_jsonb(new)->>'intencao_id')::uuid;
   if not found then raise exception 'intencao_indisponivel' using errcode='23514'; end if;
 else v_grupo:=(to_jsonb(new)->>tg_argv[0])::uuid; end if;
 if v_grupo is null then return new; end if;
 select g.visita_preparada_id into v_preparada from pcm.sso_ocorrencias_grupo g where g.id=v_grupo;
 if not found then raise exception 'grupo_indisponivel' using errcode='23514'; end if;
 if v_preparada is null then return new; end if;
 select o.visita_id into v_visita from pcm.ocorrencias_visita_preparadas o where o.id=v_preparada;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
 select habilitado into v_habilitado from pcm.sso_proteger_grupo_suprimido_gate where id for share;
 if not found then raise exception 'guarda_indisponivel' using errcode='55000'; end if;
 if not v_habilitado and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=v_visita) then return new; end if;
 perform 1 from pcm.visitas v where v.id=v_visita for update nowait;
 if not found then raise exception 'visita_indisponivel' using errcode='23514'; end if;
 perform 1 from pcm.ocorrencias_visita_preparadas o where o.id=v_preparada and o.visita_id=v_visita for share nowait;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=v_visita) then raise exception 'ocorrencia_grupo_suprimida' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_dependencia_grupo_suprimido() from public,anon,authenticated,service_role;

create trigger sso_guarda_grupo_suprimido_vinculo before insert on pcm.sso_vinculos_os_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_grupo_id');
create trigger sso_guarda_grupo_suprimido_intencao before insert on pcm.sso_intencoes_os_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_grupo_id');
create trigger sso_guarda_grupo_suprimido_atestado before insert on pcm.sso_atestados_declarados_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_id');
create trigger sso_guarda_grupo_suprimido_foto before insert on pcm.sso_fotos_atestado_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_id');
create trigger sso_guarda_grupo_suprimido_decisao before insert on pcm.sso_decisoes_foto_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_id');
create trigger sso_guarda_grupo_suprimido_quantidade before insert on pcm.sso_quantidades_declaradas_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_id');
create trigger sso_guarda_grupo_suprimido_origem before insert on pcm.sso_origens_quantidade_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_id');
create trigger sso_guarda_grupo_suprimido_pendencia before insert or update of ocorrencia_grupo_id on pcm.sso_pendencias_tecnicas for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('ocorrencia_grupo_id');
create trigger sso_guarda_grupo_suprimido_decisao_intencao before insert on pcm.sso_decisoes_intencao_grupo for each row execute function pcm.sso_guardar_dependencia_grupo_suprimido('intencao_id');
