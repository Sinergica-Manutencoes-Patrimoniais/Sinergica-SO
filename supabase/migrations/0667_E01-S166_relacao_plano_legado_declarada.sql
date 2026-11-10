-- ADR-0441: declaração humana, não é prova de equivalência nem altera geradores.
create table pcm.sso_relacao_plano_legado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_relacao_plano_legado_gate enable row level security;
alter table pcm.sso_relacao_plano_legado_gate force row level security;
revoke all on pcm.sso_relacao_plano_legado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_relacao_plano_legado_gate(id,habilitado) values(true,false);
create table pcm.sso_declaracoes_planos_legados (
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),plano_legado_id uuid not null references pcm.planos_preventivos(id),
 revisao integer not null check(revisao>0),decisao text not null check(decisao in ('declarar','retirar')),
 motivo text not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now(),payload jsonb not null,resultado jsonb not null,
 unique(plano_id,plano_legado_id,revisao)
);
alter table pcm.sso_declaracoes_planos_legados enable row level security;
alter table pcm.sso_declaracoes_planos_legados force row level security;
revoke all on pcm.sso_declaracoes_planos_legados from public,anon,authenticated,service_role;
create trigger sso_declaracoes_planos_legados_imutavel before update or delete on pcm.sso_declaracoes_planos_legados for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_declarar_relacao_plano_legado(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_plano_legado_id uuid,p_expected_revision integer,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_ant pcm.sso_declaracoes_planos_legados%rowtype;v_ultimo pcm.sso_declaracoes_planos_legados%rowtype;v_revision integer;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_relacao_plano_legado_gate where id),false) then raise exception 'relacao_plano_legado_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_plano_legado_id is null or p_expected_revision is null or p_expected_revision<0 or p_decisao is null or p_decisao not in ('declarar','retirar') or v_motivo is null or length(v_motivo)>2000 then raise exception 'declaracao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'planoLegadoId',p_plano_legado_id,'revisaoEsperada',p_expected_revision,'decisao',p_decisao,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('relacao-plano-legado-request:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_declaracoes_planos_legados where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_ant.resultado; end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'plano_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.planos_preventivos where id=p_plano_legado_id and cliente_id=p_cliente_id for share;
 if not found then raise exception 'plano_legado_indisponivel' using errcode='42501'; end if;
 select * into v_ultimo from pcm.sso_declaracoes_planos_legados where plano_id=p_plano_id and plano_legado_id=p_plano_legado_id order by revisao desc limit 1;
 v_revision:=coalesce(v_ultimo.revisao,0);
 if v_revision<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if (p_decisao='retirar' and (v_revision=0 or v_ultimo.decisao<>'declarar')) or (p_decisao='declarar' and v_ultimo.decisao='declarar') then raise exception 'decisao_incompativel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'planoLegadoId',p_plano_legado_id,'revisao',v_revision+1,'decisao',p_decisao,'equivalenciaComprovada',false,'geradorAlterado',false);
 insert into pcm.sso_declaracoes_planos_legados(request_id,cliente_id,plano_id,plano_legado_id,revisao,decisao,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,p_plano_legado_id,v_revision+1,p_decisao,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.relacao_legada_declarada','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_relacao_plano_legado(uuid,uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_planos_legados_relacao(p_cliente_id uuid,p_plano_id uuid,p_apos uuid default null,p_limite integer default 20)
returns table(id uuid,nome text,estado text,sistema_id uuid,equipamento_id uuid,primeira_data date,intervalo_n integer,intervalo_unidade text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_relacao_plano_legado_gate where id),false) then raise exception 'relacao_plano_legado_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select p.id,p.nome,p.estado,p.sistema_id,p.equipamento_id,p.primeira_data,p.intervalo_n,p.intervalo_unidade from pcm.planos_preventivos p where p.cliente_id=p_cliente_id and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_planos_legados_relacao(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_historico_relacao_plano_legado(p_cliente_id uuid,p_plano_id uuid,p_legado_id uuid,p_antes integer default null,p_limite integer default 20)
returns table(request_id uuid,revisao integer,decisao text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_relacao_plano_legado_gate where id),false) then raise exception 'relacao_plano_legado_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) or not exists(select 1 from pcm.planos_preventivos where id=p_legado_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 50 or (p_antes is not null and p_antes<1) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query select h.request_id,h.revisao,h.decisao,h.motivo,h.ator_id,h.criado_em from pcm.sso_declaracoes_planos_legados h where h.plano_id=p_plano_id and h.plano_legado_id=p_legado_id and h.cliente_id=p_cliente_id and (p_antes is null or h.revisao<p_antes) order by h.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_relacao_plano_legado(uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
