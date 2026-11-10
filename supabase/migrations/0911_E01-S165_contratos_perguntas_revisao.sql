-- ADR-0686: reconferência opt-in na versão rascunho de uma revisão.
create table pcm.sso_contratos_em_revisao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_contratos_em_revisao_gate enable row level security;alter table pcm.sso_contratos_em_revisao_gate force row level security;
revoke all on pcm.sso_contratos_em_revisao_gate from public,anon,authenticated,service_role;
insert into pcm.sso_contratos_em_revisao_gate(id,habilitado) values(true,false);
create function pcm.sso_plano_admite_contrato_revisao(p_plano_id uuid,p_estado text) returns boolean
language sql stable security definer set search_path='' as $$
 select p_estado='rascunho' or (p_estado='em_revisao' and coalesce((select habilitado from pcm.sso_contratos_em_revisao_gate where id),false) and exists(select 1 from pcm.plano_versoes v where v.plano_id=p_plano_id and v.estado='aprovado'));
$$;
revoke all on function pcm.sso_plano_admite_contrato_revisao(uuid,text) from public,anon,authenticated,service_role;
do $migration$
declare v_def text;v_func regprocedure;v_antigo text;v_novo text;
begin
 foreach v_func in array array['pcm.sso_configurar_obrigatoriedade_pergunta(uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text)'::regprocedure,'pcm.sso_configurar_evidencia_pergunta(uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text)'::regprocedure] loop
   select pg_catalog.pg_get_functiondef(v_func) into v_def;
   v_antigo:=$old$if v_plano.estado<>'rascunho' then raise exception 'plano_nao_editavel'$old$;
   v_novo:=$new$if pcm.sso_plano_admite_contrato_revisao(v_plano.id,v_plano.estado) is distinct from true then raise exception 'plano_nao_editavel'$new$;
   if position(v_antigo in v_def)=0 then raise exception 'comando_contrato_definicao_incompativel' using errcode='55000'; end if;
   execute replace(v_def,v_antigo,v_novo);
 end loop;
 foreach v_func in array array['pcm.sso_listar_contratos_pergunta_rascunho(uuid,uuid,uuid,uuid,integer,integer)'::regprocedure,'pcm.sso_listar_contratos_evidencia_rascunho(uuid,uuid,uuid,uuid,integer,integer)'::regprocedure] loop
   select pg_catalog.pg_get_functiondef(v_func) into v_def;
   v_antigo:=$old$p.estado='rascunho' and v.id=p_versao_id$old$;
   v_novo:=$new$pcm.sso_plano_admite_contrato_revisao(p.id,p.estado) is true and v.id=p_versao_id$new$;
   if position(v_antigo in v_def)=0 then raise exception 'consulta_contrato_definicao_incompativel' using errcode='55000'; end if;
   execute replace(v_def,v_antigo,v_novo);
 end loop;
end;
$migration$;
revoke all on function pcm.sso_configurar_obrigatoriedade_pergunta(uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text),pcm.sso_configurar_evidencia_pergunta(uuid,uuid,uuid,integer,uuid,uuid,text,boolean,text),pcm.sso_listar_contratos_pergunta_rascunho(uuid,uuid,uuid,uuid,integer,integer),pcm.sso_listar_contratos_evidencia_rascunho(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
