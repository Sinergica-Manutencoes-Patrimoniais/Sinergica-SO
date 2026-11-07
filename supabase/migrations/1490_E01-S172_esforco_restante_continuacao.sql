-- ADR-1340: confirmação explícita; nenhuma declaração anterior é reinterpretada.
create table pcm.sso_esforco_restante_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_esforco_restante_gate(id,habilitado) values(true,false);
alter table pcm.sso_esforco_restante_gate enable row level security;
alter table pcm.sso_esforco_restante_gate force row level security;
revoke all on pcm.sso_esforco_restante_gate from public,anon,authenticated,service_role;

create table pcm.sso_esforco_restante_confirmacoes(
  request_id uuid primary key, cliente_id uuid not null references pcm.clientes(id), os_id uuid not null references pcm.ordens_servico(id),
  proposta_id uuid not null references pcm.chamado_continuacoes_propostas(id), esforco_revision integer not null check(esforco_revision>0),
  ator_id uuid not null references auth.users(id), motivo text not null check(length(btrim(motivo)) between 1 and 2000),
  payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now(),
  unique(cliente_id,os_id,proposta_id,esforco_revision)
);
alter table pcm.sso_esforco_restante_confirmacoes enable row level security;
alter table pcm.sso_esforco_restante_confirmacoes force row level security;
revoke all on pcm.sso_esforco_restante_confirmacoes from public,anon,authenticated,service_role;
create trigger sso_esforco_restante_imutavel before update or delete on pcm.sso_esforco_restante_confirmacoes
  for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_confirmar_esforco_restante(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_esforco_revision integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_ant pcm.sso_esforco_restante_confirmacoes%rowtype;v_e pcm.capacidade_esforco_declaracoes%rowtype;
 v_payload jsonb;v_resultado jsonb;
begin
 perform 1 from pcm.sso_esforco_restante_gate where id and habilitado for share;
 if not found then raise exception 'confirmacao_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.capacidade_esforco_declarado_gate where id and habilitado for share;
 if not found then raise exception 'esforco_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_continuacao_os_parcela_gate where id and habilitado for share;
 if not found then raise exception 'continuidade_desabilitada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_proposta_id is null
   or p_esforco_revision is null or p_esforco_revision<1 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 then
   raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_invalido' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=pg_catalog.jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'propostaId',p_proposta_id,'esforcoRevision',p_esforco_revision,'motivo',btrim(p_motivo));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('esforco-restante:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_esforco_restante_confirmacoes where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_ator or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 perform 1 from pcm.ordens_servico o where o.id=p_os_id and o.client_id=p_cliente_id and o.deleted_at is null for share nowait;
 if not found then raise exception 'os_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.sso_continuacoes_os_parcela v join pcm.chamado_continuacoes_propostas p
   on p.id=v.proposta_id and p.chamado_id=v.chamado_id and p.os_anterior_id=v.os_anterior_id
     and p.os_continuacao_id=v.os_nova_id and p.situacao='executada'
   where v.os_nova_id=p_os_id and v.proposta_id=p_proposta_id and v.cliente_id=p_cliente_id for share of v,p nowait;
 if not found then raise exception 'continuidade_indisponivel' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capacidade-esforco:os:'||p_os_id::text,0));
 select * into v_e from pcm.capacidade_esforco_declaracoes where cliente_id=p_cliente_id and os_id=p_os_id order by revisao desc limit 1;
 if not found or v_e.revisao is distinct from p_esforco_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_e.internos_minutos is null or v_e.terceiros_minutos is null or v_e.acompanhamento_minutos is null
   or (v_e.internos_minutos=0 and v_e.terceiros_minutos=0 and v_e.acompanhamento_minutos=0) then
   raise exception 'esforco_incompleto' using errcode='23514'; end if;
 if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=pg_catalog.jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'osId',p_os_id,
   'propostaId',p_proposta_id,'esforcoRevision',p_esforco_revision,'restanteConfirmado',true);
 insert into pcm.sso_esforco_restante_confirmacoes(request_id,cliente_id,os_id,proposta_id,esforco_revision,ator_id,motivo,payload,resultado)
 values(p_request_id,p_cliente_id,p_os_id,p_proposta_id,p_esforco_revision,v_ator,btrim(p_motivo),v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload)
 values(v_ator,'capacidade.esforco_restante_confirmado','ordens_servico',p_os_id,v_resultado||pg_catalog.jsonb_build_object('motivo',btrim(p_motivo)));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_confirmar_esforco_restante(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_confirmar_esforco_restante(uuid,uuid,uuid,uuid,integer,text) to authenticated;

create function pcm.sso_fontes_esforco_restante(p_cliente_id uuid,p_semana_inicio date,p_apos uuid default null,p_limite integer default 50)
returns table(vinculo_id uuid,visita_id uuid,os_id uuid,os_status text,ocorrencia_legada_id uuid,ocorrencia_preparada_id uuid,ciclo_id uuid,
  inicio_em timestamptz,fuso text,estimativa_os_minutos integer,participantes bigint,deslocamento_visita_minutos integer,completude text,
  esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer,
  proposta_continuacao_id uuid,minutos_continuacao integer,esforco_restante_confirmado boolean)
language plpgsql volatile security definer set search_path='' as $$
begin
  perform 1 from pcm.sso_esforco_restante_gate where id and habilitado for share;
  if not found then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode='42501'; end if;
  return query select f.*, exists(select 1 from pcm.sso_esforco_restante_confirmacoes c
    where c.cliente_id=p_cliente_id and c.os_id=f.os_id and c.proposta_id=f.proposta_continuacao_id
      and c.esforco_revision=f.esforco_revision)
  from pcm.sso_fontes_esforco_continuacao(p_cliente_id,p_semana_inicio,p_apos,p_limite) f order by f.vinculo_id;
end; $$;
revoke all on function pcm.sso_fontes_esforco_restante(uuid,date,uuid,integer) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_fontes_esforco_restante(uuid,date,uuid,integer) to authenticated;
