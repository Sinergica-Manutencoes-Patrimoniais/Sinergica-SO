-- ADR-1141: estrutura privada; não agenda job, não envia nem autoriza efeito externo.
-- SPEC_DEVIATION: reserva própria não está integrada à auvo_sync_outbox exigida pela S168.
-- Não ativar nem produzir candidatas até corrigir fluxo único e revisar consumidores legados.
create table pcm.sso_t24_reserva_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_t24_reserva_gate(id,habilitado) values(true,false);
create table pcm.sso_t24_tentativas(
 id uuid primary key default gen_random_uuid(),cliente_id uuid not null references pcm.clientes(id),
 visita_id uuid not null references pcm.visitas(id),os_id uuid not null references pcm.ordens_servico(id),
 revisao_visita integer not null check(revisao_visita>0),operacao text not null check(operacao in ('criar','atualizar')),
 tarefa_id text check(tarefa_id is null or length(tarefa_id) between 1 and 200),
 esperado jsonb not null check(jsonb_typeof(esperado)='object' and octet_length(esperado::text)<=8192),
 questionario_obrigatorio boolean not null, elegivel_em timestamptz not null check(isfinite(elegivel_em)),
 estado text not null default 'aguardando' check(estado in ('aguardando','reservado','iniciado','incerto','reconciliacao','confirmado','bloqueado','cancelado')),
 fence bigint not null default 0 check(fence between 0 and 9007199254740991),reservado_ate timestamptz,
 criado_em timestamptz not null default now(),atualizado_em timestamptz not null default now(),
 check((operacao='criar' and tarefa_id is null) or (operacao='atualizar' and tarefa_id is not null)),
 check((estado='reservado' and reservado_ate is not null) or (estado<>'reservado' and reservado_ate is null))
);
create unique index sso_t24_uma_tentativa_ativa_por_os on pcm.sso_t24_tentativas(os_id)
 where estado in ('aguardando','reservado','iniciado','incerto','reconciliacao');
create index sso_t24_candidatos on pcm.sso_t24_tentativas(elegivel_em,id) where estado in ('aguardando','reservado');
create table pcm.sso_t24_tentativa_eventos(
 tentativa_id uuid not null references pcm.sso_t24_tentativas(id),sequencia bigint not null check(sequencia>0),
 fence bigint not null check(fence>=0),estado text not null,motivo text not null check(length(motivo) between 1 and 120),
 criado_em timestamptz not null default now(),primary key(tentativa_id,sequencia)
);
alter table pcm.sso_t24_reserva_gate enable row level security;alter table pcm.sso_t24_reserva_gate force row level security;
alter table pcm.sso_t24_tentativas enable row level security;alter table pcm.sso_t24_tentativas force row level security;
alter table pcm.sso_t24_tentativa_eventos enable row level security;alter table pcm.sso_t24_tentativa_eventos force row level security;
revoke all on pcm.sso_t24_reserva_gate,pcm.sso_t24_tentativas,pcm.sso_t24_tentativa_eventos from public,anon,authenticated,service_role;
create trigger sso_t24_eventos_imutaveis before update or delete on pcm.sso_t24_tentativa_eventos
 for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_t24_reservar_candidata(p_duracao_segundos integer) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_t24_tentativas%rowtype;v_sequencia bigint;v_agora timestamptz:=clock_timestamp();
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if coalesce(auth.role(),'')<>'service_role' then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 if p_duracao_segundos is null or p_duracao_segundos not between 10 and 300 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_t24_reserva_gate where id and habilitado for share;
 if not found then raise exception 'reserva_desabilitada' using errcode='55000'; end if;
 select * into v from pcm.sso_t24_tentativas where elegivel_em<=v_agora and
  (estado='aguardando' or (estado='reservado' and reservado_ate<=v_agora))
  order by elegivel_em,id for update skip locked limit 1;
 if not found then return null; end if;
 if v.fence>=9007199254740991 then raise exception 'fence_esgotado' using errcode='22003'; end if;
 update pcm.sso_t24_tentativas set estado='reservado',fence=fence+1,reservado_ate=v_agora+make_interval(secs=>p_duracao_segundos),atualizado_em=v_agora
  where id=v.id returning * into v;
 select coalesce(max(sequencia),0)+1 into v_sequencia from pcm.sso_t24_tentativa_eventos where tentativa_id=v.id;
 insert into pcm.sso_t24_tentativa_eventos(tentativa_id,sequencia,fence,estado,motivo) values(v.id,v_sequencia,v.fence,'reservado','candidata_reservada');
 return jsonb_build_object('tentativaId',v.id,'clienteId',v.cliente_id,'visitaId',v.visita_id,'osId',v.os_id,
  'revisao',v.revisao_visita,'operacao',v.operacao,'tarefaId',v.tarefa_id,'esperado',v.esperado,
  'questionarioObrigatorio',v.questionario_obrigatorio,'fence',v.fence,'reservadoAte',v.reservado_ate,'autorizaEnvio',false);
end; $$;
revoke all on function pcm.sso_t24_reservar_candidata(integer) from public,anon,authenticated,service_role;
