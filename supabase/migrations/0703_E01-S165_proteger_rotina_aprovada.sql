-- ADR-0477: defesa adicional opt-in; rascunhos continuam editáveis.
create table pcm.sso_rotina_aprovada_imutavel_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_rotina_aprovada_imutavel_gate enable row level security;
alter table pcm.sso_rotina_aprovada_imutavel_gate force row level security;
revoke all on pcm.sso_rotina_aprovada_imutavel_gate from public,anon,authenticated,service_role;
insert into pcm.sso_rotina_aprovada_imutavel_gate(id,habilitado) values(true,false);

create function pcm.sso_proteger_rotina_versao_aprovada() returns trigger language plpgsql security definer set search_path='' as $$
declare v_antiga uuid;v_nova uuid;v_estado text;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_rotina_aprovada_imutavel_gate where id),false) then if tg_op='DELETE' then return old; else return new; end if;end if;
 if tg_op<>'INSERT' then v_antiga:=old.versao_id;end if;
 if tg_op<>'DELETE' then v_nova:=new.versao_id;end if;
 for v_id,v_estado in select id,estado from pcm.plano_versoes where id in (v_antiga,v_nova) order by id for share loop
  if v_estado='aprovado' then raise exception 'rotina_aprovada_imutavel_exige_nova_versao' using errcode='23514';end if;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end; $$;
revoke all on function pcm.sso_proteger_rotina_versao_aprovada() from public,anon,authenticated,service_role;
create trigger sso_proteger_rotina_versao_aprovada before insert or update or delete on pcm.rotinas_manutencao for each row execute function pcm.sso_proteger_rotina_versao_aprovada();
