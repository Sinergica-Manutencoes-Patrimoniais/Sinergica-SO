-- ADR-1679: protocolo v2 para mudança de dia em grande volume.
-- Fundação somente: gate fechado; o protocolo RPC e o orçamento operacional
-- serão acrescentados depois dos ensaios de contrato e escala.
do $$ begin
 if not exists (
   select 1 from pg_catalog.pg_roles
   where rolname=current_user and (rolsuper or rolbypassrls)
 ) then raise exception 'owner_requer_bypassrls' using errcode='42501'; end if;
 if not has_schema_privilege(current_user,'pcm','USAGE')
   or not has_schema_privilege(current_user,'pcm','CREATE')
   or not has_table_privilege(current_user,'pcm.visitas','SELECT')
   or not has_table_privilege(current_user,'pcm.visita_origem_contratual','SELECT')
   or not has_table_privilege(current_user,'pcm.visita_ordens_servico','SELECT')
   or not has_table_privilege(current_user,'pcm.ordens_servico','SELECT')
   or not has_table_privilege(current_user,'pcm.ocorrencias_visita_preparadas','SELECT')
   or not has_table_privilege(current_user,'pcm.visita_transicoes_historico','SELECT')
   or not has_table_privilege(current_user,'pcm.regras_visita_contratual','SELECT')
   or not has_table_privilege(current_user,'pcm.calendario_contratual_series','SELECT')
   or not has_table_privilege(current_user,'pcm.feriados_declarados','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_supressoes_semana_feriado','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_revogacoes_supressao_semana','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_visita_regra_transicoes','SELECT')
   or not has_table_privilege(current_user,'pcm.calendario_contratual_comandos','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_supressoes_semana_feriado','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_visitas_suprimidas_feriado','SELECT')
   or not has_table_privilege(current_user,'pcm.sso_movimentos_ocorrencias_dia','SELECT')
   then raise exception 'owner_sem_privilegios_mudanca_dia_v2' using errcode='42501'; end if;
 if not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and rolsuper)
   and exists (
     select 1
     from (values
       ('pcm.visitas'),('pcm.visita_origem_contratual'),('pcm.regras_visita_contratual'),
       ('pcm.calendario_contratual_series'),('pcm.visita_ordens_servico'),('pcm.ordens_servico'),
       ('pcm.visita_transicoes_historico'),('pcm.ocorrencias_visita_preparadas'),
       ('pcm.sso_supressoes_semana_feriado'),('pcm.sso_revogacoes_supressao_semana')
     ) as alvo(nome)
     where not has_table_privilege(current_user,alvo.nome,'TRIGGER')
        or not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
          where (n.nspname||'.'||c.relname)=alvo.nome and c.relowner=to_regrole(current_user)::oid)
   ) then raise exception 'owner_sem_privilegios_trigger_mudanca_dia_v2' using errcode='42501'; end if;
end $$;

create table pcm.sso_mudanca_dia_v2_gate (
 id boolean primary key default true check(id),
 habilitado boolean not null default false,
 max_itens integer not null default 500 check(max_itens>0),
 max_bytes bigint not null default 1048576 check(max_bytes>0),
 ttl_seconds integer not null default 3600 check(ttl_seconds>0),
 atualizado_em timestamptz not null default now()
);
insert into pcm.sso_mudanca_dia_v2_gate(id,habilitado,max_itens,max_bytes,ttl_seconds)
values(true,false,500,1048576,3600);
alter table pcm.sso_mudanca_dia_v2_gate enable row level security;
alter table pcm.sso_mudanca_dia_v2_gate force row level security;
revoke all on pcm.sso_mudanca_dia_v2_gate from public,anon,authenticated,service_role;

create table pcm.sso_mudancas_dia_v2 (
 id uuid primary key,
 request_id uuid not null unique,
 actor_id uuid not null references auth.users(id),
 cliente_id uuid not null references pcm.clientes(id),
 serie_id uuid not null references pcm.calendario_contratual_series(id),
 regra_id uuid not null references pcm.regras_visita_contratual(id),
 regra_nova_id uuid not null unique,
 revisao_esperada integer not null check(revisao_esperada>0),
 dia_semana integer not null check(dia_semana between 1 and 7),
 vigencia date not null check(isfinite(vigencia)),
 estado text not null default 'montando'
   check(estado in ('montando','pronta','aplicada','invalidada','expirada')),
 cursor_ultimo uuid,
 pagina_seguinte integer not null default 0 check(pagina_seguinte>=0),
 pagina_final boolean not null default false,
 total_itens integer not null default 0 check(total_itens>=0),
 total_bytes bigint not null default 0 check(total_bytes>=0),
 digest_fotografia text,
 recibo jsonb,
 criado_em timestamptz not null default now(),
 atualizado_em timestamptz not null default now(),
 expira_em timestamptz not null,
 selada_em timestamptz,
 aplicada_em timestamptz,
 constraint sso_mudanca_dia_v2_expira_valida check(expira_em>criado_em),
 constraint sso_mudanca_dia_v2_estado_selado check(
   (estado='montando' and selada_em is null and aplicada_em is null and recibo is null and digest_fotografia is null)
   or (estado='pronta' and selada_em is not null and aplicada_em is null and recibo is null and digest_fotografia is not null)
   or (estado in ('invalidada','expirada') and aplicada_em is null and recibo is null)
   or (estado='aplicada' and selada_em is not null and aplicada_em is not null and recibo is not null and digest_fotografia is not null)
 )
);
create index sso_mudancas_dia_v2_expiracao_idx
 on pcm.sso_mudancas_dia_v2(expira_em) where estado in ('montando','pronta','invalidada');
create index sso_mudancas_dia_v2_serie_estado_idx
 on pcm.sso_mudancas_dia_v2(serie_id,estado,criado_em desc);
alter table pcm.sso_mudancas_dia_v2 enable row level security;
alter table pcm.sso_mudancas_dia_v2 force row level security;
revoke all on pcm.sso_mudancas_dia_v2 from public,anon,authenticated,service_role;

create table pcm.sso_mudanca_dia_v2_itens (
 mudanca_id uuid not null references pcm.sso_mudancas_dia_v2(id),
 visita_id uuid not null references pcm.visitas(id),
 revisao_visita integer not null check(revisao_visita>0),
 semana_origem date not null check(isfinite(semana_origem)),
 inicio_original timestamptz not null,
 fim_original timestamptz not null,
 inicio_proposto timestamptz,
 data_proposta date not null check(isfinite(data_proposta)),
 feriado_id uuid,
 feriado_revisao integer,
 ocorrencia_esperada boolean not null,
 criado_em timestamptz not null default now(),
 primary key(mudanca_id,visita_id),
 constraint sso_mudanca_dia_v2_item_feriado check(
   (feriado_id is null and feriado_revisao is null) or (feriado_id is not null and feriado_revisao>0)
 )
);
create index sso_mudanca_dia_v2_itens_visita_idx
 on pcm.sso_mudanca_dia_v2_itens(visita_id,mudanca_id);
alter table pcm.sso_mudanca_dia_v2_itens enable row level security;
alter table pcm.sso_mudanca_dia_v2_itens force row level security;
revoke all on pcm.sso_mudanca_dia_v2_itens from public,anon,authenticated,service_role;

create table pcm.sso_mudanca_dia_v2_paginas (
 mudanca_id uuid not null references pcm.sso_mudancas_dia_v2(id),
 numero integer not null check(numero>=0),
 cursor_antes uuid,
 cursor_depois uuid,
 tem_mais boolean not null,
 total_itens integer not null check(total_itens>=0),
 total_bytes bigint not null check(total_bytes>=0),
 criada_em timestamptz not null default now(),
 primary key(mudanca_id,numero),
 constraint sso_mudanca_dia_v2_pagina_cursor check(cursor_depois is null or cursor_antes is null or cursor_depois>cursor_antes)
);
alter table pcm.sso_mudanca_dia_v2_paginas enable row level security;
alter table pcm.sso_mudanca_dia_v2_paginas force row level security;
revoke all on pcm.sso_mudanca_dia_v2_paginas from public,anon,authenticated,service_role;

create function pcm.sso_lock_mudanca_dia_v2(p_serie_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_ativo boolean;
begin
 if p_serie_id is null then return; end if;
 select g.habilitado into v_ativo from pcm.sso_mudanca_dia_v2_gate g where g.id for share;
 if not coalesce(v_ativo,false) then return; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(
   pg_catalog.hashtextextended('sso-mudanca-dia-v2:'||p_serie_id::text,0)
 ) then raise exception 'mudanca_dia_em_conflito' using errcode='55P03'; end if;
end $$;
revoke all on function pcm.sso_lock_mudanca_dia_v2(uuid) from public,anon,authenticated,service_role;

create function pcm.sso_guardar_mudanca_dia_visita_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_serie uuid;v_id uuid;
begin
 v_id:=case when tg_op='DELETE' then old.id else new.id end;
 select o.serie_id into v_serie from pcm.visita_origem_contratual o where o.visita_id=v_id;
 if v_serie is not null then perform pcm.sso_lock_mudanca_dia_v2(v_serie); end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_visita_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_visita
 before update or delete on pcm.visitas for each row
 execute function pcm.sso_guardar_mudanca_dia_visita_v2();

create function pcm.sso_guardar_mudanca_dia_origem_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_lock_mudanca_dia_v2(new.serie_id);
 return new;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_origem_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_origem
 before insert on pcm.visita_origem_contratual for each row
 execute function pcm.sso_guardar_mudanca_dia_origem_v2();

create function pcm.sso_guardar_mudanca_dia_regra_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_serie uuid;
begin
 if tg_op<>'INSERT' then perform pcm.sso_lock_mudanca_dia_v2(old.serie_id); end if;
 if tg_op<>'DELETE' then perform pcm.sso_lock_mudanca_dia_v2(new.serie_id); end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_regra_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_regra
 before insert or update or delete on pcm.regras_visita_contratual for each row
 execute function pcm.sso_guardar_mudanca_dia_regra_v2();

create function pcm.sso_guardar_mudanca_dia_serie_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' then perform pcm.sso_lock_mudanca_dia_v2(old.id); end if;
 if tg_op<>'DELETE' then perform pcm.sso_lock_mudanca_dia_v2(new.id); end if;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_serie_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_serie
 before update or delete on pcm.calendario_contratual_series for each row
 execute function pcm.sso_guardar_mudanca_dia_serie_v2();

create function pcm.sso_guardar_mudanca_dia_vinculo_os_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_serie uuid;v_ids uuid[];
begin
 select array_agg(distinct o.serie_id order by o.serie_id) into v_ids
 from pcm.visita_origem_contratual o
 where o.visita_id in (
   case when tg_op<>'INSERT' then old.visita_id else null end,
   case when tg_op<>'DELETE' then new.visita_id else null end
 );
 foreach v_serie in array coalesce(v_ids,'{}'::uuid[]) loop
   perform pcm.sso_lock_mudanca_dia_v2(v_serie);
 end loop;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_vinculo_os_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_vinculo_os
 before insert or update or delete on pcm.visita_ordens_servico for each row
 execute function pcm.sso_guardar_mudanca_dia_vinculo_os_v2();

create function pcm.sso_guardar_mudanca_dia_os_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_serie uuid;v_ids uuid[];
begin
 if tg_op='UPDATE' and old.auvo_task_id is not distinct from new.auvo_task_id
   and old.auvo_sync_status is not distinct from new.auvo_sync_status
   and old.client_id is not distinct from new.client_id then return new; end if;
 select array_agg(distinct o.serie_id order by o.serie_id) into v_ids
 from pcm.visita_ordens_servico vo
 join pcm.visita_origem_contratual o on o.visita_id=vo.visita_id
 where vo.os_id=case when tg_op='DELETE' then old.id else new.id end;
 foreach v_serie in array coalesce(v_ids,'{}'::uuid[]) loop
   perform pcm.sso_lock_mudanca_dia_v2(v_serie);
 end loop;
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_os_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_os
 before update or delete on pcm.ordens_servico for each row
 execute function pcm.sso_guardar_mudanca_dia_os_v2();

create function pcm.sso_guardar_mudanca_dia_transicao_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_serie uuid;
begin
 if new.acao='reprogramar' then
   select o.serie_id into v_serie from pcm.visita_origem_contratual o where o.visita_id=new.visita_id;
   if v_serie is not null then perform pcm.sso_lock_mudanca_dia_v2(v_serie); end if;
 end if;
 return new;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_transicao_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_transicao
 before insert on pcm.visita_transicoes_historico for each row
 execute function pcm.sso_guardar_mudanca_dia_transicao_v2();

create function pcm.sso_guardar_mudanca_dia_ocorrencia_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_lock_mudanca_dia_v2(case when tg_op='DELETE' then old.serie_id else new.serie_id end);
 return case when tg_op='DELETE' then old else new end;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_ocorrencia_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_ocorrencia
 before insert or update or delete on pcm.ocorrencias_visita_preparadas for each row
 execute function pcm.sso_guardar_mudanca_dia_ocorrencia_v2();

create function pcm.sso_guardar_mudanca_dia_supressao_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
begin
 perform pcm.sso_lock_mudanca_dia_v2(new.serie_id);
 return new;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_supressao_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_supressao
 before insert on pcm.sso_supressoes_semana_feriado for each row
 execute function pcm.sso_guardar_mudanca_dia_supressao_v2();

create function pcm.sso_guardar_mudanca_dia_revogacao_v2()
returns trigger language plpgsql volatile security definer set search_path='' as $$
declare v_serie uuid;
begin
 select s.serie_id into v_serie from pcm.sso_supressoes_semana_feriado s where s.id=new.supressao_id;
 if v_serie is not null then perform pcm.sso_lock_mudanca_dia_v2(v_serie); end if;
 return new;
end $$;
revoke all on function pcm.sso_guardar_mudanca_dia_revogacao_v2() from public,anon,authenticated,service_role;
create trigger sso_mudanca_dia_v2_revogacao
 before insert on pcm.sso_revogacoes_supressao_semana for each row
 execute function pcm.sso_guardar_mudanca_dia_revogacao_v2();

revoke all on function pcm.sso_lock_mudanca_dia_v2(uuid) from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_visita_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_origem_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_regra_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_serie_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_vinculo_os_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_os_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_transicao_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_ocorrencia_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_supressao_v2() from public,anon,authenticated,service_role;
revoke all on function pcm.sso_guardar_mudanca_dia_revogacao_v2() from public,anon,authenticated,service_role;
