create table pcm.sso_correcao_quarentena_csv_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_correcao_quarentena_csv_gate(id,habilitado) values(true,false);
create table pcm.sso_quarentena_csv_correcoes(id uuid primary key default gen_random_uuid(),request_id uuid not null unique,lote_id uuid not null,numero integer not null,revisao integer not null check(revisao>0),estado_declarado text not null check(estado_declarado in ('apta_estruturalmente','rejeitada')),celulas jsonb not null,erros_declarados jsonb not null,motivo text not null check(length(btrim(motivo)) between 1 and 2000),ator_id uuid not null references auth.users(id),payload jsonb not null,criado_em timestamptz not null default now(),unique(lote_id,revisao),foreign key(lote_id,numero) references pcm.sso_quarentena_csv_linhas(lote_id,numero));
alter table pcm.sso_correcao_quarentena_csv_gate enable row level security;alter table pcm.sso_correcao_quarentena_csv_gate force row level security;
alter table pcm.sso_quarentena_csv_correcoes enable row level security;alter table pcm.sso_quarentena_csv_correcoes force row level security;
revoke all on pcm.sso_correcao_quarentena_csv_gate,pcm.sso_quarentena_csv_correcoes from public,anon,authenticated,service_role;
create trigger sso_quarentena_csv_correcoes_imutaveis before update or delete on pcm.sso_quarentena_csv_correcoes for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_listar_quarentena_csv(p_cliente_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,chave_origem text,ator_id uuid,criado_em timestamptz,revisao integer) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_correcao_quarentena_csv_gate where id),false) or not coalesce((select habilitado from pcm.sso_quarentena_csv_gate where id),false) then raise exception 'quarentena_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('cadastro.gerir',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select l.id,l.chave_origem,l.ator_id,l.criado_em,coalesce((select max(c.revisao) from pcm.sso_quarentena_csv_correcoes c where c.lote_id=l.id),0) from pcm.sso_quarentena_csv_lotes l where l.cliente_id=p_cliente_id and (p_apos is null or l.id>p_apos) order by l.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_quarentena_csv(uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_listar_linhas_quarentena_csv(p_lote_id uuid,p_apos integer,p_limite integer)
returns table(numero integer,estado_declarado text,celulas jsonb,erros_declarados jsonb,revisao_linha integer,revisao_lote integer)
language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_quarentena_csv_lotes%rowtype;v_rev integer;
begin
 if not coalesce((select habilitado from pcm.sso_correcao_quarentena_csv_gate where id),false) or not coalesce((select habilitado from pcm.sso_quarentena_csv_gate where id),false) then raise exception 'quarentena_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_lote_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<1) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select * into v_lote from pcm.sso_quarentena_csv_lotes where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.gerir',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_quarentena_csv_correcoes where lote_id=p_lote_id;
 return query select l.numero,coalesce(c.estado_declarado,l.estado_declarado),coalesce(c.celulas,l.celulas),coalesce(c.erros_declarados,l.erros_declarados),coalesce(c.revisao,0),v_rev from pcm.sso_quarentena_csv_linhas l left join lateral (select x.estado_declarado,x.celulas,x.erros_declarados,x.revisao from pcm.sso_quarentena_csv_correcoes x where x.lote_id=l.lote_id and x.numero=l.numero order by x.revisao desc limit 1) c on true where l.lote_id=p_lote_id and (p_apos is null or l.numero>p_apos) order by l.numero limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_linhas_quarentena_csv(uuid,integer,integer) from public,anon,authenticated,service_role;
create function pcm.sso_corrigir_linha_quarentena_csv(p_request_id uuid,p_lote_id uuid,p_expected_revision integer,p_numero integer,p_estado text,p_celulas jsonb,p_erros jsonb,p_motivo text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lote pcm.sso_quarentena_csv_lotes%rowtype;v_ant pcm.sso_quarentena_csv_correcoes%rowtype;v_rev integer;v_payload jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_correcao_quarentena_csv_gate where id),false) or not coalesce((select habilitado from pcm.sso_quarentena_csv_gate where id),false) then raise exception 'quarentena_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_lote_id is null or p_expected_revision is null or p_expected_revision<0 or p_numero is null or p_numero<2 or p_estado is null or p_estado not in ('apta_estruturalmente','rejeitada') or jsonb_typeof(p_celulas) is distinct from 'array' or jsonb_typeof(p_erros) is distinct from 'array' or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if jsonb_array_length(p_celulas) not between 1 and 100 or jsonb_array_length(p_erros)>30 or (p_estado='rejeitada' and jsonb_array_length(p_erros)=0) or (p_estado='apta_estruturalmente' and jsonb_array_length(p_erros)<>0) or octet_length(p_celulas::text)+octet_length(p_erros::text)>30000 then raise exception 'limite_excedido' using errcode='22023'; end if;
 if exists(select 1 from jsonb_array_elements(p_celulas) c where jsonb_typeof(c) is distinct from 'string') or exists(select 1 from jsonb_array_elements(p_erros) e where jsonb_typeof(e) is distinct from 'string' or length(btrim(e #>> '{}')) not between 1 and 500) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('loteId',p_lote_id,'expectedRevision',p_expected_revision,'numero',p_numero,'estado',p_estado,'celulas',p_celulas,'erros',p_erros,'motivo',btrim(p_motivo));perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('corrigir-quarentena:'||p_request_id::text,0));
 select * into v_lote from pcm.sso_quarentena_csv_lotes where id=p_lote_id for update;
 if not found or config.sso_autorizar_acao('cadastro.gerir',v_lote.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_quarentena_csv_correcoes where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from auth.uid() or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'numero',p_numero,'revision',v_ant.revisao,'oficialAlterado',false); end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_quarentena_csv_correcoes where lote_id=p_lote_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from pcm.sso_quarentena_csv_linhas where lote_id=p_lote_id and numero=p_numero) then raise exception 'linha_indisponivel' using errcode='23514'; end if;
 insert into pcm.sso_quarentena_csv_correcoes(request_id,lote_id,numero,revisao,estado_declarado,celulas,erros_declarados,motivo,ator_id,payload) values(p_request_id,p_lote_id,p_numero,v_rev+1,p_estado,p_celulas,p_erros,btrim(p_motivo),auth.uid(),v_payload);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'levantamento.quarentena_corrigida','sso_quarentena_csv_lotes',p_lote_id,jsonb_build_object('requestId',p_request_id,'clienteId',v_lote.cliente_id,'numero',p_numero,'revision',v_rev+1,'motivo',btrim(p_motivo),'oficialAlterado',false));
 return jsonb_build_object('requestId',p_request_id,'loteId',p_lote_id,'numero',p_numero,'revision',v_rev+1,'oficialAlterado',false);
end; $$;
revoke all on function pcm.sso_corrigir_linha_quarentena_csv(uuid,uuid,integer,integer,text,jsonb,jsonb,text) from public,anon,authenticated,service_role;
create function pcm.sso_historico_linha_quarentena_csv(p_lote_id uuid,p_numero integer,p_apos integer,p_limite integer)
returns table(revisao integer,estado_declarado text,celulas jsonb,erros_declarados jsonb,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;
begin
 if not coalesce((select habilitado from pcm.sso_correcao_quarentena_csv_gate where id),false) or not coalesce((select habilitado from pcm.sso_quarentena_csv_gate where id),false) then raise exception 'quarentena_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_lote_id is null or p_numero is null or p_numero<2 or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select cliente_id into v_cliente from pcm.sso_quarentena_csv_lotes where id=p_lote_id;
 if v_cliente is null or config.sso_autorizar_acao('cadastro.gerir',v_cliente) is not true or not exists(select 1 from pcm.sso_quarentena_csv_linhas where lote_id=p_lote_id and numero=p_numero) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select c.revisao,c.estado_declarado,c.celulas,c.erros_declarados,c.motivo,c.ator_id,c.criado_em from pcm.sso_quarentena_csv_correcoes c where c.lote_id=p_lote_id and c.numero=p_numero and (p_apos is null or c.revisao>p_apos) order by c.revisao limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_linha_quarentena_csv(uuid,integer,integer,integer) from public,anon,authenticated,service_role;
