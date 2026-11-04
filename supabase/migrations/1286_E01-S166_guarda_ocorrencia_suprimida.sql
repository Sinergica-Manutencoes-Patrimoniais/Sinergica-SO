-- ADR-1127: gate independente e bloqueio de criação de vínculos posteriores.
create table pcm.sso_ocorrencia_visita_suprimivel_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_ocorrencia_visita_suprimivel_gate(id,habilitado) values(true,false);
alter table pcm.sso_ocorrencia_visita_suprimivel_gate enable row level security;
alter table pcm.sso_ocorrencia_visita_suprimivel_gate force row level security;
revoke all on pcm.sso_ocorrencia_visita_suprimivel_gate from public,anon,authenticated,service_role;

create function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida() returns trigger
language plpgsql volatile security definer set search_path='' as $$
declare v_id uuid;v_visita uuid;v_habilitado boolean;
begin
 if tg_argv[0]='preparada_id' then v_id:=(to_jsonb(new)->>'preparada_id')::uuid;
 elsif tg_argv[0]='ocorrencia_visita_id' then v_id:=(to_jsonb(new)->>'ocorrencia_visita_id')::uuid;
 elsif tg_argv[0]='visita_preparada_id' then v_id:=(to_jsonb(new)->>'visita_preparada_id')::uuid;
 else raise exception 'configuracao_invalida' using errcode='22023'; end if;
 if v_id is null then return new; end if;
 select o.visita_id into v_visita from pcm.ocorrencias_visita_preparadas o where o.id=v_id;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
 select habilitado into v_habilitado from pcm.sso_ocorrencia_visita_suprimivel_gate where id for share;
 if not found then raise exception 'supressao_indisponivel' using errcode='55000'; end if;
 if not v_habilitado and not exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=v_visita) then return new; end if;
 perform 1 from pcm.visitas v where v.id=v_visita for update nowait;
 perform 1 from pcm.ocorrencias_visita_preparadas o where o.id=v_id and o.visita_id=v_visita for share nowait;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_visitas_suprimidas_feriado s where s.visita_id=v_visita) then
  raise exception 'ocorrencia_visita_suprimida' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida() from public,anon,authenticated,service_role;
create trigger sso_guarda_ponte_visita_suprimida before insert on pcm.sso_vinculos_visita_legado for each row execute function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida('ocorrencia_visita_id');
create trigger sso_guarda_materializacao_visita_suprimida before insert on pcm.sso_materializacoes_visita_legado for each row execute function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida('preparada_id');
create trigger sso_guarda_ciclo_visita_suprimida before insert on pcm.sso_ciclo_visita_versoes for each row execute function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida('preparada_id');
create trigger sso_guarda_uso_ciclo_visita_suprimida before insert on pcm.sso_ciclo_visita_usos_versao for each row execute function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida('preparada_id');
create trigger sso_guarda_grupo_visita_suprimida before insert on pcm.sso_ocorrencias_grupo for each row execute function pcm.sso_guardar_vinculo_ocorrencia_visita_suprimida('visita_preparada_id');
