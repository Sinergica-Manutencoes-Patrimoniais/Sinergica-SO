-- ADR-0798. Evidência declarada, não cálculo nem comprovação de cobertura.
create table pcm.capacidade_vinculo_intervalo_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
alter table pcm.capacidade_vinculo_intervalo_gate enable row level security;
alter table pcm.capacidade_vinculo_intervalo_gate force row level security;
revoke all on pcm.capacidade_vinculo_intervalo_gate from public, anon, authenticated, service_role;
insert into pcm.capacidade_vinculo_intervalo_gate values (true, false);

create table pcm.capacidade_vinculo_intervalo_eventos (
  request_id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  disponibilidade_id uuid not null references pcm.capacidade_disponibilidades(id),
  intervalo_id uuid not null references pcm.capacidade_intervalos_declarados(id),
  revisao_disponibilidade integer not null check (revisao_disponibilidade > 0),
  revisao_vinculo integer not null check (revisao_vinculo > 0),
  incluido boolean not null,
  justificativa text not null check (length(btrim(justificativa)) between 1 and 500),
  ator_id uuid not null references auth.users(id),
  criado_em timestamptz not null default now(),
  unique (disponibilidade_id, intervalo_id, revisao_disponibilidade, revisao_vinculo)
);
alter table pcm.capacidade_vinculo_intervalo_eventos enable row level security;
alter table pcm.capacidade_vinculo_intervalo_eventos force row level security;
revoke all on pcm.capacidade_vinculo_intervalo_eventos from public, anon, authenticated, service_role;
create trigger capacidade_vinculo_intervalo_imutavel before update or delete on pcm.capacidade_vinculo_intervalo_eventos
  for each row execute function pcm.sso_proteger_intervalo_capacidade();

create function pcm.sso_declarar_vinculo_intervalo(
 p_request_id uuid, p_cliente_id uuid, p_disponibilidade_id uuid, p_intervalo_id uuid,
 p_revisao_disponibilidade integer, p_revisao_vinculo integer, p_incluido boolean, p_justificativa text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor uuid := auth.uid(); v_disp pcm.capacidade_disponibilidades%rowtype;
 v_intervalo pcm.capacidade_intervalos_declarados%rowtype;
 v_anterior pcm.capacidade_vinculo_intervalo_eventos%rowtype; v_revisao integer;
begin
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then
   raise exception 'isolamento_autorizacao_incompativel' using errcode='25001';
 end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
   raise exception 'autorizacao_em_alteracao' using errcode='55P03';
 end if;
 perform 1 from pcm.capacidade_vinculo_intervalo_gate where id and habilitado for share;
 if not found then raise exception 'vinculo_intervalo_bloqueado' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_disponibilidade_id is null or p_intervalo_id is null
   or p_revisao_disponibilidade is null or p_revisao_disponibilidade < 1 or p_revisao_vinculo is null or p_revisao_vinculo < 0
   or p_incluido is null or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 500 then
   raise exception 'vinculo_intervalo_invalido' using errcode='22023';
 end if;
 if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then
   raise exception 'vinculo_intervalo_sem_acesso' using errcode='42501';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capacidade-vinculo-request:'||p_request_id::text,0));
 select * into v_disp from pcm.capacidade_disponibilidades where id=p_disponibilidade_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'vinculo_intervalo_sem_acesso' using errcode='42501'; end if;
 select * into v_intervalo from pcm.capacidade_intervalos_declarados where id=p_intervalo_id and disponibilidade_id=v_disp.id;
 if not found then raise exception 'vinculo_intervalo_sem_acesso' using errcode='42501'; end if;
 select * into v_anterior from pcm.capacidade_vinculo_intervalo_eventos where request_id=p_request_id;
 if found then
   if v_anterior.cliente_id is distinct from p_cliente_id or v_anterior.disponibilidade_id is distinct from p_disponibilidade_id
     or v_anterior.intervalo_id is distinct from p_intervalo_id or v_anterior.revisao_disponibilidade is distinct from p_revisao_disponibilidade
     or v_anterior.revisao_vinculo is distinct from p_revisao_vinculo+1 or v_anterior.incluido is distinct from p_incluido
     or v_anterior.justificativa is distinct from btrim(p_justificativa) or v_anterior.ator_id is distinct from v_actor then
     raise exception 'request_id_conflitante' using errcode='23505';
   end if;
   return jsonb_build_object('requestId',p_request_id,'revision',v_anterior.revisao_vinculo,'coberturaComprovada',false);
 end if;
 if v_disp.revisao <> p_revisao_disponibilidade then raise exception 'revisao_disponibilidade_obsoleta' using errcode='40001'; end if;
 select coalesce(max(revisao_vinculo),0) into v_revisao from pcm.capacidade_vinculo_intervalo_eventos
   where disponibilidade_id=p_disponibilidade_id and intervalo_id=p_intervalo_id and revisao_disponibilidade=p_revisao_disponibilidade;
 if v_revisao <> p_revisao_vinculo then raise exception 'revisao_vinculo_obsoleta' using errcode='40001'; end if;
 insert into pcm.capacidade_vinculo_intervalo_eventos(request_id,cliente_id,disponibilidade_id,intervalo_id,revisao_disponibilidade,revisao_vinculo,incluido,justificativa,ator_id)
   values(p_request_id,p_cliente_id,p_disponibilidade_id,p_intervalo_id,p_revisao_disponibilidade,v_revisao+1,p_incluido,btrim(p_justificativa),v_actor);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'capacidade.vinculo_intervalo_declarado','capacidade_disponibilidades',p_disponibilidade_id,
   jsonb_build_object('requestId',p_request_id,'intervaloId',p_intervalo_id,'revisaoDisponibilidade',p_revisao_disponibilidade,'revisaoVinculo',v_revisao+1,'incluido',p_incluido,'justificativa',btrim(p_justificativa)));
 return jsonb_build_object('requestId',p_request_id,'revision',v_revisao+1,'coberturaComprovada',false);
end; $$;
revoke all on function pcm.sso_declarar_vinculo_intervalo(uuid,uuid,uuid,uuid,integer,integer,boolean,text) from public,anon,authenticated,service_role;
