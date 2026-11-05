-- ADR-0644: novas ocorrências usam quantidade congelada na versão quando gate ativo.
create table pcm.sso_ocorrencia_quantidade_aprovada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_ocorrencia_quantidade_aprovada_gate enable row level security;
alter table pcm.sso_ocorrencia_quantidade_aprovada_gate force row level security;
revoke all on pcm.sso_ocorrencia_quantidade_aprovada_gate from public,anon,authenticated,service_role;
insert into pcm.sso_ocorrencia_quantidade_aprovada_gate(id,habilitado) values(true,false);
create table pcm.sso_origens_quantidade_grupo(ocorrencia_id uuid primary key references pcm.sso_ocorrencias_grupo(id),quantidade_aprovada bigint not null,revisao_aprovada integer not null,quantidade_atual_registro bigint not null,revisao_atual_registro integer not null,criado_em timestamptz not null default now());
alter table pcm.sso_origens_quantidade_grupo enable row level security;
alter table pcm.sso_origens_quantidade_grupo force row level security;
revoke all on pcm.sso_origens_quantidade_grupo from public,anon,authenticated,service_role;
create trigger sso_origem_quantidade_grupo_imutavel before update or delete on pcm.sso_origens_quantidade_grupo for each row execute function pcm.sso_proteger_conferencia_levantamento();
do $migration$
declare v_def text;
 v_ancora text := $old$ if v_n<>1 then raise exception 'rotina_historica_incompativel' using errcode='23514'; end if;$old$;
 v_bloco text := $new$ if v_n<>1 then raise exception 'rotina_historica_incompativel' using errcode='23514'; end if;
 if coalesce((select habilitado from pcm.sso_ocorrencia_quantidade_aprovada_gate where id),false) then
   if jsonb_typeof(v_snapshot->'quantidades_grupo') is distinct from 'array' then raise exception 'quantidade_aprovada_indisponivel' using errcode='23514'; end if;
   select count(*),min(item::text)::jsonb into v_qtd_n,v_qtd_snapshot from jsonb_array_elements(v_snapshot->'quantidades_grupo') x(item) where item->>'rotinaId'=v_rotina::text and item->>'grupoId'=v_alvo::text;
   if v_qtd_n<>1 or coalesce(v_qtd_snapshot->>'quantidade','') !~ '^[1-9][0-9]{0,15}$' or coalesce(v_qtd_snapshot->>'revisao','') !~ '^[1-9][0-9]{0,8}$' or (v_qtd_snapshot->>'quantidade')::numeric>9007199254740991 then raise exception 'quantidade_aprovada_invalida' using errcode='23514'; end if;
   v_atual_qtd:=v_grupo.quantidade;v_atual_rev:=v_grupo.revisao;
   v_grupo.quantidade:=(v_qtd_snapshot->>'quantidade')::bigint;v_grupo.revisao:=(v_qtd_snapshot->>'revisao')::integer;
 end if;$new$;
 v_insert text := $old$ insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'calendario.ocorrencia_grupo_registrada'$old$;
 v_insert_novo text := $new$ if coalesce((select habilitado from pcm.sso_ocorrencia_quantidade_aprovada_gate where id),false) then
   insert into pcm.sso_origens_quantidade_grupo(ocorrencia_id,quantidade_aprovada,revisao_aprovada,quantidade_atual_registro,revisao_atual_registro) values(v_id,v_grupo.quantidade,v_grupo.revisao,v_atual_qtd,v_atual_rev);
 end if;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'calendario.ocorrencia_grupo_registrada'$new$;
begin
 select pg_catalog.pg_get_functiondef('pcm.sso_registrar_ocorrencia_grupo(uuid,uuid,text,uuid)'::regprocedure) into v_def;
 if position(v_ancora in v_def)=0 or position(v_insert in v_def)=0 or position(' v_plano uuid;v_versao uuid;' in v_def)=0 then raise exception 'registro_grupo_definicao_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,' v_plano uuid;v_versao uuid;',' v_qtd_n integer;v_qtd_snapshot jsonb;v_atual_qtd bigint;v_atual_rev integer;v_plano uuid;v_versao uuid;');
 v_def:=replace(v_def,v_ancora,v_bloco);v_def:=replace(v_def,v_insert,v_insert_novo);execute v_def;
end;
$migration$;
revoke all on function pcm.sso_registrar_ocorrencia_grupo(uuid,uuid,text,uuid) from public,anon,authenticated,service_role;
