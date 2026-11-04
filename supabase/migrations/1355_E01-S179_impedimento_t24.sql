-- ADR-1201: proteção parcial de início T24, desabilitada por padrão.
create table pcm.sso_impedimento_material_t24_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_impedimento_material_t24_gate(id,habilitado) values(true,false);
alter table pcm.sso_impedimento_material_t24_gate enable row level security;
alter table pcm.sso_impedimento_material_t24_gate force row level security;
revoke all on pcm.sso_impedimento_material_t24_gate from public,anon,authenticated,service_role;
create function pcm.sso_exigir_os_sem_impedimento_material_t24(p_os_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
declare v_ativo boolean;v_estado text;
begin
 select g.habilitado into v_ativo from pcm.sso_impedimento_material_t24_gate g where g.id for share;
 if not found then raise exception 'gate_indisponivel' using errcode='55000'; end if;
 if not v_ativo then return; end if;
 if p_os_id is null or auth.role() is distinct from 'service_role' then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('impedimento-material-os:'||p_os_id::text,0)) then raise exception 'os_em_alteracao' using errcode='55P03'; end if;
 select e.estado into v_estado from pcm.sso_impedimento_material_os_eventos e where e.os_id=p_os_id order by e.revisao desc limit 1;
 if v_estado='suspenso' then raise exception 'impedimento_material_ativo' using errcode='55000'; end if;
end; $$;
revoke all on function pcm.sso_exigir_os_sem_impedimento_material_t24(uuid) from public,anon,authenticated,service_role;

-- Preserva OID e ACL; falha se a definição não for a esperada.
do $$
declare v_def text;v_marcador text:=E' select protocolo into v_protocolo from pcm.sso_t24_produtor_recibos';
begin
 v_def:=pg_catalog.pg_get_functiondef('pcm.sso_t24_iniciar_efeito(uuid,uuid,bigint)'::regprocedure);
 if pg_catalog.strpos(v_def,v_marcador)=0 or pg_catalog.strpos(v_def,'sso_exigir_os_sem_impedimento_material_t24')>0 then raise exception 'definicao_t24_incompativel' using errcode='55000'; end if;
 v_def:=pg_catalog.replace(v_def,v_marcador,E' perform pcm.sso_exigir_os_sem_impedimento_material_t24(t.os_id);\n'||v_marcador);
 execute v_def;
end; $$;
