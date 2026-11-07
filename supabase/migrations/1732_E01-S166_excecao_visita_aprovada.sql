-- ADR-1590: aprovação explícita de exceção vinculada a Visita já existente.
create table pcm.sso_excecao_visita_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_excecao_visita_gate(id,habilitado) values(true,false);
alter table pcm.sso_excecao_visita_gate enable row level security;
alter table pcm.sso_excecao_visita_gate force row level security;
revoke all on pcm.sso_excecao_visita_gate from public,anon,authenticated,service_role;
create table pcm.sso_excecoes_visita_aprovadas(
 request_id uuid primary key,cliente_id uuid not null,visita_id uuid not null,revisao_visita integer not null,
 data_civil date not null,origem text not null,natureza text not null,motivo text not null,ator_id uuid not null references auth.users(id),
 fotografia jsonb not null,payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default clock_timestamp(),
 foreign key(visita_id,cliente_id) references pcm.visitas(id,cliente_id),unique(visita_id)
);
alter table pcm.sso_excecoes_visita_aprovadas enable row level security;
alter table pcm.sso_excecoes_visita_aprovadas force row level security;
revoke all on pcm.sso_excecoes_visita_aprovadas from public,anon,authenticated,service_role;
create trigger sso_excecao_visita_imutavel before update or delete on pcm.sso_excecoes_visita_aprovadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_aprovar_excecao_visita(p_ator uuid,p_request uuid,p_cliente uuid,p_visita uuid,p_revisao integer,p_data date,p_origem text,p_natureza text,p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.visitas%rowtype; a pcm.sso_excecoes_visita_aprovadas%rowtype; payload jsonb; resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' or current_setting('session_replication_role')<>'origin' then raise exception 'transacao_invalida' using errcode='25001';end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_request is null or p_cliente is null or p_visita is null or p_revisao is null or p_revisao<1 or p_data is null or not isfinite(p_data)
  or nullif(btrim(p_origem),'') is null or length(p_origem)>500 or nullif(btrim(p_natureza),'') is null or length(p_natureza)>200 or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03';end if;
 perform 1 from pcm.sso_excecao_visita_gate where id and habilitado for share;if not found then raise exception 'operacao_desabilitada' using errcode='55000';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 payload:=jsonb_build_object('clienteId',p_cliente,'visitaId',p_visita,'revisao',p_revisao,'data',p_data,'origem',btrim(p_origem),'natureza',btrim(p_natureza),'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-excecao-visita:'||p_request::text,0));
 select * into a from pcm.sso_excecoes_visita_aprovadas where request_id=p_request;
 if found then
  if a.ator_id is distinct from p_ator or a.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505';end if;
  if not exists(select 1 from pcm.visitas where id=a.visita_id and cliente_id=p_cliente) then raise exception 'sem_acesso' using errcode='42501';end if;
  return a.resultado;
 end if;
 lock table pcm.sso_excecoes_visita_aprovadas in row exclusive mode nowait;
 select * into v from pcm.visitas where id=p_visita and cliente_id=p_cliente for update nowait;
 if not found then raise exception 'visita_indisponivel' using errcode='42501';end if;
 if v.revisao is distinct from p_revisao or (v.inicio_em at time zone v.fuso)::date is distinct from p_data then raise exception 'visita_obsoleta' using errcode='40001';end if;
 if v.estado in ('cancelada','concluida') then raise exception 'visita_nao_elegivel' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 resultado:=jsonb_build_object('requestId',p_request,'visitaId',p_visita,'revisaoVisita',p_revisao,'aprovada',true,'visitaAlterada',false,'osAlteradas',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_excecoes_visita_aprovadas(request_id,cliente_id,visita_id,revisao_visita,data_civil,origem,natureza,motivo,ator_id,fotografia,payload,resultado)
 values(p_request,p_cliente,p_visita,p_revisao,p_data,btrim(p_origem),btrim(p_natureza),btrim(p_motivo),p_ator,to_jsonb(v),payload,resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'visita.excecao_aprovada','visitas',p_visita,resultado||jsonb_build_object('motivo',btrim(p_motivo)));
 return resultado;
end; $$;
revoke all on function pcm.sso_aprovar_excecao_visita(uuid,uuid,uuid,uuid,integer,date,text,text,text) from public,anon,authenticated,service_role;

-- A exclusão não depende do gate: decisões históricas continuam protegidas.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_alterar_dia_com_visitas(uuid,uuid,uuid,uuid,uuid,integer,integer,date,jsonb)'::regprocedure);
 a text:=$a$ for v_linha in
   select v.*,o.semana_origem$a$;
 b text:=$b$ lock table pcm.sso_excecoes_visita_aprovadas in share mode nowait;
 for v_linha in
   select v.*,o.semana_origem$b$;
 c text:=$a$and not exists(select 1 from pcm.visita_transicoes_historico h where h.visita_id=v.id and h.acao='reprogramar')$a$;
 e text:=$b$and not exists(select 1 from pcm.visita_transicoes_historico h where h.visita_id=v.id and h.acao='reprogramar')
     and not exists(select 1 from pcm.sso_excecoes_visita_aprovadas ex where ex.visita_id=v.id and ex.cliente_id=v.cliente_id)$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,c,'')))/length(c)<>1 then raise exception 'mudanca_dia_incompativel' using errcode='55000';end if;
 execute replace(replace(d,a,b),c,e);
end; $migracao$;

-- Prévia usa a mesma exclusão e conserva o contrato da classificação existente.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_prever_mudanca_dia(uuid,uuid,uuid,integer,date,integer,date,uuid,integer)'::regprocedure);
 a text:=$a$and not exists(select 1 from pcm.visita_transicoes_historico h where h.visita_id=v.id and h.acao='reprogramar')$a$;
 b text:=$b$and not exists(select 1 from pcm.visita_transicoes_historico h where h.visita_id=v.id and h.acao='reprogramar')
        and not exists(select 1 from pcm.sso_excecoes_visita_aprovadas ex where ex.visita_id=v.id and ex.cliente_id=v.cliente_id)$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'previa_mudanca_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

-- Histórico consultável mesmo com escrita desabilitada, sob autorização atual.
create function pcm.sso_consultar_excecao_visita(p_ator uuid,p_cliente uuid,p_visita uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a pcm.sso_excecoes_visita_aprovadas%rowtype;v pcm.visitas%rowtype;
begin
 if auth.uid() is null or auth.uid() is distinct from p_ator or p_cliente is null or p_visita is null
  or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v from pcm.visitas where id=p_visita and cliente_id=p_cliente for share nowait;
 if not found then raise exception 'visita_indisponivel' using errcode='42501';end if;
 select * into a from pcm.sso_excecoes_visita_aprovadas where visita_id=p_visita and cliente_id=p_cliente;
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 if a.request_id is null then return jsonb_build_object('visitaId',p_visita,'aprovada',false,'revisaoAtual',v.revisao,'dataAtual',(v.inicio_em at time zone v.fuso)::date);end if;
 return jsonb_build_object('visitaId',p_visita,'aprovada',true,'revisaoAtual',v.revisao,'dataAtual',(v.inicio_em at time zone v.fuso)::date,'requestId',a.request_id,'revisaoVisita',a.revisao_visita,'data',a.data_civil,'origem',a.origem,'natureza',a.natureza,'motivo',a.motivo,'atorId',a.ator_id,'aprovadaEm',a.criado_em);
end; $$;
revoke all on function pcm.sso_consultar_excecao_visita(uuid,uuid,uuid) from public,anon,authenticated,service_role;

grant execute on function pcm.sso_aprovar_excecao_visita(uuid,uuid,uuid,uuid,integer,date,text,text,text) to authenticated;
grant execute on function pcm.sso_consultar_excecao_visita(uuid,uuid,uuid) to authenticated;
