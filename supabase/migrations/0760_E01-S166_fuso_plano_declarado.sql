-- ADR-0535: fonte humana explícita; não altera cálculos de geração existentes.
create table pcm.sso_fuso_plano_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_fuso_plano_gate enable row level security;alter table pcm.sso_fuso_plano_gate force row level security;
revoke all on pcm.sso_fuso_plano_gate from public,anon,authenticated,service_role;
insert into pcm.sso_fuso_plano_gate(id,habilitado) values(true,false);
create table pcm.sso_fusos_plano_declarados (
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),revisao integer not null check(revisao>0),fuso text not null,contrato_referencia_id uuid,fonte text not null,motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(plano_id,revisao)
);
alter table pcm.sso_fusos_plano_declarados enable row level security;alter table pcm.sso_fusos_plano_declarados force row level security;
revoke all on pcm.sso_fusos_plano_declarados from public,anon,authenticated,service_role;
create trigger sso_fuso_plano_imutavel before update or delete on pcm.sso_fusos_plano_declarados for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_declarar_fuso_plano(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_expected_revision integer,p_fuso text,p_contrato_referencia_id uuid,p_fonte text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_ant pcm.sso_fusos_plano_declarados%rowtype;v_rev integer;v_payload jsonb;v_resultado jsonb;v_fuso text:=nullif(btrim(p_fuso),'');v_fonte text:=nullif(btrim(p_fonte),'');v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_fuso_plano_gate where id),false) then raise exception 'fuso_plano_bloqueado' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_expected_revision is null or p_expected_revision<0 or v_fuso is null or v_fonte is null or length(v_fonte)>500 or v_motivo is null or length(v_motivo)>2000 then raise exception 'declaracao_invalida' using errcode='22023';end if;
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=v_fuso) then raise exception 'fuso_iana_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'revisaoEsperada',p_expected_revision,'fuso',v_fuso,'contratoReferenciaId',p_contrato_referencia_id,'fonte',v_fonte,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fuso-plano:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_fusos_plano_declarados where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 perform 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'plano_indisponivel' using errcode='42501';end if;
 if p_contrato_referencia_id is not null and not exists(select 1 from comercial.contratos where id=p_contrato_referencia_id and cliente_id=p_cliente_id) then raise exception 'contrato_referencia_indisponivel' using errcode='23514';end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_fusos_plano_declarados where plano_id=p_plano_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'planoId',p_plano_id,'revisao',v_rev+1,'fusoDeclarado',v_fuso,'contratoReferenciaId',p_contrato_referencia_id,'vinculoContratualComprovado',false,'fonteValidada',false,'geracaoAlterada',false);
 insert into pcm.sso_fusos_plano_declarados(request_id,cliente_id,plano_id,revisao,fuso,contrato_referencia_id,fonte,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_plano_id,v_rev+1,v_fuso,p_contrato_referencia_id,v_fonte,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'plano.fuso_declarado','planos_manutencao',p_plano_id,v_resultado||jsonb_build_object('fonte',v_fonte,'motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_fuso_plano(uuid,uuid,uuid,integer,text,uuid,text,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_fusos_iana_plano(p_cliente_id uuid,p_plano_id uuid,p_busca text,p_apos text default null,p_limite integer default 30)
returns table(fuso text) language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_fuso_plano_gate where id),false) then raise exception 'fuso_plano_bloqueado' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_busca is null or length(btrim(p_busca)) not between 2 and 100 or p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023';end if;
 return query select t.name from pg_catalog.pg_timezone_names t where position(lower(btrim(p_busca)) in lower(t.name))>0 and (p_apos is null or t.name>p_apos) order by t.name limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_fusos_iana_plano(uuid,uuid,text,text,integer) from public,anon,authenticated,service_role;

create function pcm.sso_historico_fuso_plano(p_cliente_id uuid,p_plano_id uuid,p_antes integer default null,p_limite integer default 20)
returns table(request_id uuid,revisao integer,fuso text,contrato_referencia_id uuid,fonte text,motivo text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_fuso_plano_gate where id),false) then raise exception 'fuso_plano_bloqueado' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_limite is null or p_limite not between 1 and 50 or (p_antes is not null and p_antes<1) then raise exception 'consulta_invalida' using errcode='22023';end if;
 return query select d.request_id,d.revisao,d.fuso,d.contrato_referencia_id,d.fonte,d.motivo,d.ator_id,d.criado_em from pcm.sso_fusos_plano_declarados d where d.plano_id=p_plano_id and d.cliente_id=p_cliente_id and (p_antes is null or d.revisao<p_antes) order by d.revisao desc limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_fuso_plano(uuid,uuid,integer,integer) from public,anon,authenticated,service_role;
