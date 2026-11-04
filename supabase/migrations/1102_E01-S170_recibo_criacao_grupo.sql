-- ADR-0948: recibo privado e imutável, sem EXECUTE operacional.
create table config.sso_criacoes_grupo(
  id uuid primary key, ator_id uuid not null references auth.users(id),
  payload jsonb not null, criado_em timestamptz not null default now()
);
alter table config.sso_criacoes_grupo enable row level security;
alter table config.sso_criacoes_grupo force row level security;
revoke all on config.sso_criacoes_grupo from public,anon,authenticated,service_role;
create function config.sso_criacoes_grupo_imutaveis() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'historico_imutavel' using errcode='23514'; end; $$;
revoke all on function config.sso_criacoes_grupo_imutaveis() from public,anon,authenticated,service_role;
create trigger sso_criacoes_grupo_imutaveis before update or delete on config.sso_criacoes_grupo for each row execute function config.sso_criacoes_grupo_imutaveis();

create or replace function config.sso_criar_grupo_atomico(p_id uuid,p_nome text,p_descricao text,p_permissoes jsonb,p_ator_esperado uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_par jsonb;v_ator uuid:=auth.uid();v_payload jsonb;v_ant config.sso_criacoes_grupo%rowtype;v_permissoes jsonb;
begin
  if v_ator is null or p_ator_esperado is distinct from v_ator or p_id is null or p_nome is null or length(btrim(p_nome))=0
    or jsonb_typeof(p_permissoes) is distinct from 'array' or jsonb_array_length(p_permissoes)>9 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  for v_par in select value from jsonb_array_elements(p_permissoes) loop
    if jsonb_typeof(v_par) is distinct from 'object' or (v_par - 'modulo' - 'nivel') <> '{}'::jsonb
      or jsonb_typeof(v_par->'modulo') is distinct from 'string' or jsonb_typeof(v_par->'nivel') is distinct from 'string'
      or v_par->>'modulo' not in ('pcm','atendimento','comercial','financeiro','operacao','marketing','growth','gestao','area-cliente')
      or v_par->>'nivel' not in ('leitura','escrita') then raise exception 'permissoes_invalidas' using errcode='22023'; end if;
  end loop;
  if (select count(distinct x.value->>'modulo') from jsonb_array_elements(p_permissoes) x)<>jsonb_array_length(p_permissoes) then raise exception 'modulos_duplicados' using errcode='22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  if coalesce(auth.jwt()->>'user_role','') not in ('superadmin','supervisor') or not exists(select 1 from config.usuarios u where u.user_id=v_ator and u.ativo and u.papel in ('superadmin','supervisor')) then raise exception 'sem_acesso' using errcode='42501'; end if;
  select coalesce(jsonb_agg(x.value order by x.value->>'modulo'),'[]'::jsonb) into v_permissoes from jsonb_array_elements(p_permissoes) x;
  v_payload:=jsonb_build_object('nome',p_nome,'descricao',p_descricao,'permissoes',v_permissoes);
  select * into v_ant from config.sso_criacoes_grupo where id=p_id;
  if found then
    if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
    return;
  end if;
  insert into config.grupos(id,nome,descricao,created_by) values(p_id,p_nome,p_descricao,v_ator);
  insert into config.grupo_modulos(grupo_id,modulo,nivel,created_by)
    select p_id,x.value->>'modulo',x.value->>'nivel',v_ator from jsonb_array_elements(v_permissoes) x;
  insert into config.sso_criacoes_grupo(id,ator_id,payload) values(p_id,v_ator,v_payload);
  insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'grupo.criado','grupos',p_id,jsonb_build_object('requestId',p_id));
end; $$;
revoke all on function config.sso_criar_grupo_atomico(uuid,text,text,jsonb,uuid) from public,anon,authenticated,service_role;
