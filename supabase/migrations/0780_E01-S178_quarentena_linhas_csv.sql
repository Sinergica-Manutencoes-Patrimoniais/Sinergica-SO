create table pcm.sso_quarentena_csv_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_quarentena_csv_gate(id,habilitado) values(true,false);
create table pcm.sso_quarentena_csv_lotes(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,cliente_id uuid not null references pcm.clientes(id),chave_origem text not null check(length(btrim(chave_origem)) between 1 and 200),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now());
create table pcm.sso_quarentena_csv_linhas(lote_id uuid not null references pcm.sso_quarentena_csv_lotes(id),numero integer not null check(numero>=2),estado_declarado text not null check(estado_declarado in ('apta_estruturalmente','rejeitada')),celulas jsonb not null,erros_declarados jsonb not null,primary key(lote_id,numero));
alter table pcm.sso_quarentena_csv_gate enable row level security;alter table pcm.sso_quarentena_csv_gate force row level security;
alter table pcm.sso_quarentena_csv_lotes enable row level security;alter table pcm.sso_quarentena_csv_lotes force row level security;
alter table pcm.sso_quarentena_csv_linhas enable row level security;alter table pcm.sso_quarentena_csv_linhas force row level security;
revoke all on pcm.sso_quarentena_csv_gate,pcm.sso_quarentena_csv_lotes,pcm.sso_quarentena_csv_linhas from public,anon,authenticated,service_role;
create trigger sso_quarentena_csv_lotes_imutaveis before update or delete on pcm.sso_quarentena_csv_lotes for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_quarentena_csv_linhas_imutaveis before update or delete on pcm.sso_quarentena_csv_linhas for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_receber_quarentena_csv(p_request_id uuid,p_cliente_id uuid,p_chave_origem text,p_linhas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ant pcm.sso_quarentena_csv_lotes%rowtype;v_payload jsonb;v_linha jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_quarentena_csv_gate where id),false) then raise exception 'quarentena_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_chave_origem is null or length(btrim(p_chave_origem)) not between 1 and 200 or jsonb_typeof(p_linhas) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if jsonb_array_length(p_linhas) not between 1 and 1000 or octet_length(p_linhas::text)>1048576 then raise exception 'limite_excedido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 for v_linha in select value from jsonb_array_elements(p_linhas) loop
   if jsonb_typeof(v_linha) is distinct from 'object' or (v_linha-'numero'-'estado'-'celulas'-'erros')<>'{}'::jsonb or jsonb_typeof(v_linha->'numero') is distinct from 'number' or (v_linha->>'numero') !~ '^[1-9][0-9]{0,4}$' or v_linha->>'estado' is null or v_linha->>'estado' not in ('apta_estruturalmente','rejeitada') or jsonb_typeof(v_linha->'celulas') is distinct from 'array' or jsonb_typeof(v_linha->'erros') is distinct from 'array' or octet_length(v_linha::text)>32768 then raise exception 'linha_invalida' using errcode='22023'; end if;
   if (v_linha->>'numero')::integer<2 or jsonb_array_length(v_linha->'celulas') not between 1 and 100 or jsonb_array_length(v_linha->'erros')>30 or (v_linha->>'estado'='rejeitada' and jsonb_array_length(v_linha->'erros')=0) or (v_linha->>'estado'='apta_estruturalmente' and jsonb_array_length(v_linha->'erros')<>0) then raise exception 'linha_invalida' using errcode='22023'; end if;
   if exists(select 1 from jsonb_array_elements(v_linha->'celulas') c where jsonb_typeof(c) is distinct from 'string') or exists(select 1 from jsonb_array_elements(v_linha->'erros') e where jsonb_typeof(e) is distinct from 'string' or length(btrim(e #>> '{}')) not between 1 and 500) then raise exception 'linha_invalida' using errcode='22023'; end if;
 end loop;
 if not exists(select 1 from jsonb_array_elements(p_linhas) x where x->>'estado'='rejeitada') then raise exception 'sem_linhas_rejeitadas' using errcode='22023'; end if;
 if (select count(distinct (x->>'numero')::integer) from jsonb_array_elements(p_linhas) x)<>jsonb_array_length(p_linhas) then raise exception 'registro_duplicado' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'chaveOrigem',btrim(p_chave_origem),'linhas',p_linhas);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('quarentena-csv:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_quarentena_csv_lotes where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return jsonb_build_object('requestId',p_request_id,'quarentenaId',v_ant.id,'quantidade',jsonb_array_length(p_linhas),'oficialAlterado',false); end if;
 insert into pcm.sso_quarentena_csv_lotes(request_id,cliente_id,chave_origem,ator_id,payload) values(p_request_id,p_cliente_id,btrim(p_chave_origem),auth.uid(),v_payload) returning id into v_id;
 insert into pcm.sso_quarentena_csv_linhas(lote_id,numero,estado_declarado,celulas,erros_declarados) select v_id,(x->>'numero')::integer,x->>'estado',x->'celulas',x->'erros' from jsonb_array_elements(p_linhas) x;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.csv_quarentenado','sso_quarentena_csv_lotes',v_id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'quantidade',jsonb_array_length(p_linhas),'oficialAlterado',false));
 return jsonb_build_object('requestId',p_request_id,'quarentenaId',v_id,'quantidade',jsonb_array_length(p_linhas),'oficialAlterado',false);
end; $$;
revoke all on function pcm.sso_receber_quarentena_csv(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
