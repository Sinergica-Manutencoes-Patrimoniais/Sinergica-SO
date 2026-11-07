-- ADR-0113: declaração de disponibilidade, sem inferir demanda consolidada.
insert into config.sso_acoes(codigo, modulo, nivel, exige_concessao_individual)
values ('capacidade.gerir', 'pcm', 'escrita', false) on conflict (codigo) do nothing;
insert into config.sso_acao_modulos(acao, modulo, nivel)
values ('capacidade.gerir', 'pcm', 'escrita') on conflict (acao, modulo) do nothing;

create table pcm.capacidade_disponibilidades (
  id uuid primary key,
  cliente_id uuid not null references pcm.clientes(id),
  funcionario_id uuid not null references pcm.funcionarios(id),
  semana_inicio date not null check (isfinite(semana_inicio) and extract(isodow from semana_inicio) = 1),
  destinados_minutos integer not null check (destinados_minutos >= 0),
  reservas_minutos integer not null check (reservas_minutos >= 0),
  ausencias_minutos integer not null check (ausencias_minutos >= 0),
  revisao integer not null default 1 check (revisao > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  check (reservas_minutos::bigint + ausencias_minutos::bigint <= destinados_minutos::bigint),
  unique (cliente_id, funcionario_id, semana_inicio)
);
alter table pcm.capacidade_disponibilidades enable row level security;
alter table pcm.capacidade_disponibilidades force row level security;
revoke all on pcm.capacidade_disponibilidades from public, anon, authenticated, service_role;
grant select on pcm.capacidade_disponibilidades to authenticated;
create policy capacidade_disponibilidade_leitura on pcm.capacidade_disponibilidades for select to authenticated
using (config.sso_autorizar_acao('capacidade.gerir', cliente_id));

create table pcm.capacidade_comandos (
  request_id uuid primary key, actor_id uuid not null references auth.users(id),
  cliente_id uuid not null references pcm.clientes(id), payload jsonb not null, resultado jsonb not null,
  created_at timestamptz not null default now()
);
alter table pcm.capacidade_comandos enable row level security;
alter table pcm.capacidade_comandos force row level security;
revoke all on pcm.capacidade_comandos from public, anon, authenticated, service_role;

create function pcm.sso_salvar_disponibilidade_semanal(
 p_request_id uuid, p_id uuid, p_cliente_id uuid, p_funcionario_id uuid, p_semana_inicio date,
 p_destinados integer, p_reservas integer, p_ausencias integer, p_confirmacao_sem_sobreposicao boolean,
 p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 v_actor uuid := auth.uid(); v_payload jsonb; v_resultado jsonb;
 v_comando pcm.capacidade_comandos%rowtype; v_atual pcm.capacidade_disponibilidades%rowtype;
 v_antes jsonb; v_novo boolean;
begin
 if v_actor is null or p_request_id is null or p_id is null or p_cliente_id is null or p_funcionario_id is null
   or p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio) <> 1
   or p_destinados is null or p_reservas is null or p_ausencias is null
   or p_destinados < 0 or p_reservas < 0 or p_ausencias < 0
   or p_reservas::bigint + p_ausencias::bigint > p_destinados::bigint
   or p_confirmacao_sem_sobreposicao is distinct from true or p_expected_revision is null or p_expected_revision < 0 then
   raise exception 'disponibilidade_invalida' using errcode = '22023';
 end if;
 v_payload := jsonb_build_object('id',p_id,'clienteId',p_cliente_id,'funcionarioId',p_funcionario_id,
   'semanaInicio',p_semana_inicio,'destinados',p_destinados,'reservas',p_reservas,'ausencias',p_ausencias,
   'confirmacaoSemSobreposicao',p_confirmacao_sem_sobreposicao,'expectedRevision',p_expected_revision);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capacidade-request:' || p_request_id::text, 0));
 select * into v_comando from pcm.capacidade_comandos where request_id = p_request_id;
 if v_comando.request_id is not null then
   if v_comando.actor_id is distinct from v_actor or not config.sso_autorizar_acao('capacidade.gerir', v_comando.cliente_id) then
     raise exception 'capacidade_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
   if v_comando.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode = '23505'; end if;
   return v_comando.resultado;
 end if;
 if not config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) then raise exception 'capacidade_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
 perform 1 from pcm.funcionarios where id = p_funcionario_id and ativo and deleted_at is null for share;
 if not found then raise exception 'funcionario_invalido' using errcode = '23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(jsonb_build_array('capacidade',p_cliente_id,p_funcionario_id,p_semana_inicio)::text, 0));
 select * into v_atual from pcm.capacidade_disponibilidades where cliente_id = p_cliente_id and funcionario_id = p_funcionario_id and semana_inicio = p_semana_inicio for update;
 v_novo := not found;
 if not config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) then raise exception 'capacidade_nao_encontrada_ou_sem_acesso' using errcode = '42501'; end if;
 if v_novo then
   if p_expected_revision <> 0 then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
   insert into pcm.capacidade_disponibilidades(id,cliente_id,funcionario_id,semana_inicio,destinados_minutos,reservas_minutos,ausencias_minutos,created_by,updated_by)
     values (p_id,p_cliente_id,p_funcionario_id,p_semana_inicio,p_destinados,p_reservas,p_ausencias,v_actor,v_actor) returning * into v_atual;
 else
   if v_atual.id <> p_id or v_atual.revisao <> p_expected_revision then raise exception 'revisao_obsoleta' using errcode = '40001'; end if;
   v_antes := to_jsonb(v_atual);
   update pcm.capacidade_disponibilidades set destinados_minutos=p_destinados, reservas_minutos=p_reservas,
     ausencias_minutos=p_ausencias, revisao=revisao+1, updated_by=v_actor, updated_at=now()
     where id=p_id returning * into v_atual;
 end if;
 v_resultado := jsonb_build_object('aggregateId',v_atual.id,'revision',v_atual.revisao,'state','declarada',
   'created',v_novo,'linkedIds',jsonb_build_object('funcionarioId',p_funcionario_id),'warnings',jsonb_build_array('sobreposicao_nao_verificada'),'requestId',p_request_id);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values (v_actor,'capacidade.disponibilidade_declarada',
   'capacidade_disponibilidades',v_atual.id,jsonb_build_object('requestId',p_request_id,'antes',v_antes,'depois',to_jsonb(v_atual),'confirmacaoSemSobreposicao',true));
 insert into pcm.capacidade_comandos(request_id,actor_id,cliente_id,payload,resultado) values(p_request_id,v_actor,p_cliente_id,v_payload,v_resultado);
 return v_resultado;
end;
$$;
revoke all on function pcm.sso_salvar_disponibilidade_semanal(uuid,uuid,uuid,uuid,date,integer,integer,integer,boolean,integer) from public,anon,service_role;
grant execute on function pcm.sso_salvar_disponibilidade_semanal(uuid,uuid,uuid,uuid,date,integer,integer,integer,boolean,integer) to authenticated;
