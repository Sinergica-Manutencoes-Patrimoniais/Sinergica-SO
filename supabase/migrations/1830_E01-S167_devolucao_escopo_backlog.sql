-- E01-S167 AC-6 (primeira metade: Chamado suspenso): devolve parcela não resolvida ao Backlog
-- (E01-S174). Decisão do Lucas (2026-11-10): PCM escolhe o ativo (alvo_tipo/alvo_id) no momento
-- da devolução — chamado_escopo_parcelas não tem vínculo de ativo, diferente de
-- sso_pendencias_tecnicas (que sempre nasce de um alvo de preventiva). Não cobre "cancelado com
-- escopo pendente": pcm.sso_cancelar_chamado_conservador (0623) exige tudo já resolvido pra
-- cancelar — isso é gap separado, de uma entrega futura de cancelamento não conservador.
--
-- Reverso: drop function if exists pcm.sso_devolver_parcela_chamado_backlog(uuid,uuid,uuid,uuid,text,uuid,text);
--          drop table if exists pcm.sso_devolucoes_escopo_chamado;
--          drop table if exists pcm.sso_devolucao_escopo_backlog_gate;
--          alter table pcm.sso_ciclos_backlog drop constraint sso_ciclos_backlog_legado_pendencia_id_fkey;
--          alter table pcm.sso_backlog_parcelas drop constraint sso_backlog_parcelas_origem_pendencia_check;
--          alter table pcm.sso_backlog_parcelas drop column origem;
--          alter table pcm.sso_backlog_parcelas drop constraint sso_backlog_parcelas_pkey;
--          alter table pcm.sso_backlog_parcelas drop column id;
--          alter table pcm.sso_backlog_parcelas drop constraint sso_backlog_parcelas_pendencia_id_key;
--          alter table pcm.sso_backlog_parcelas alter column pendencia_id set not null;
--          alter table pcm.sso_backlog_parcelas add primary key (pendencia_id);
--          alter table pcm.sso_ciclos_backlog add constraint sso_ciclos_backlog_legado_pendencia_id_fkey foreign key (legado_pendencia_id) references pcm.sso_backlog_parcelas(pendencia_id);
--          (reverso só é seguro enquanto a tabela estiver vazia em produção — gate nasce fechado)

-- pcm.sso_ciclos_backlog(legado_pendencia_id) referencia sso_backlog_parcelas(pendencia_id); como
-- essa FK está amarrada ao índice do PK atual (pendencia_id), precisa ser solta antes de trocar o
-- PK e recriada depois apontando pro novo unique constraint explícito — mesma coluna, mesmo
-- destino, só o índice de apoio muda.
alter table pcm.sso_ciclos_backlog drop constraint sso_ciclos_backlog_legado_pendencia_id_fkey;
alter table pcm.sso_backlog_parcelas drop constraint sso_backlog_parcelas_pkey;
alter table pcm.sso_backlog_parcelas add constraint sso_backlog_parcelas_pendencia_id_key unique (pendencia_id);
alter table pcm.sso_ciclos_backlog add constraint sso_ciclos_backlog_legado_pendencia_id_fkey foreign key (legado_pendencia_id) references pcm.sso_backlog_parcelas(pendencia_id);
alter table pcm.sso_backlog_parcelas alter column pendencia_id drop not null;
alter table pcm.sso_backlog_parcelas add column id uuid not null default gen_random_uuid();
alter table pcm.sso_backlog_parcelas add constraint sso_backlog_parcelas_pkey primary key (id);
alter table pcm.sso_backlog_parcelas add column origem text not null default 'pendencia_tecnica' check (origem in ('pendencia_tecnica', 'chamado_devolvido'));
alter table pcm.sso_backlog_parcelas add constraint sso_backlog_parcelas_origem_pendencia_check
  check ((origem = 'pendencia_tecnica' and pendencia_id is not null) or (origem = 'chamado_devolvido' and pendencia_id is null));

create table pcm.sso_devolucao_escopo_backlog_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_devolucao_escopo_backlog_gate(id, habilitado) values(true, false);
alter table pcm.sso_devolucao_escopo_backlog_gate enable row level security;
alter table pcm.sso_devolucao_escopo_backlog_gate force row level security;
revoke all on pcm.sso_devolucao_escopo_backlog_gate from public, anon, authenticated, service_role;

create table pcm.sso_devolucoes_escopo_chamado(
  request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
  chamado_id uuid not null references pcm.chamados(id), parcela_id uuid not null unique references pcm.chamado_escopo_parcelas(id),
  backlog_parcela_id uuid not null references pcm.sso_backlog_parcelas(id), payload jsonb not null, resultado jsonb not null,
  criado_em timestamptz not null default now()
);
alter table pcm.sso_devolucoes_escopo_chamado enable row level security;
alter table pcm.sso_devolucoes_escopo_chamado force row level security;
revoke all on pcm.sso_devolucoes_escopo_chamado from public, anon, authenticated, service_role;

create function pcm.sso_devolver_parcela_chamado_backlog(
  p_request_id uuid, p_cliente_id uuid, p_chamado_id uuid, p_parcela_id uuid, p_alvo_tipo text, p_alvo_id uuid, p_motivo text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_anterior pcm.sso_devolucoes_escopo_chamado%rowtype; v_parcela pcm.chamado_escopo_parcelas%rowtype;
  v_composicao_id uuid; v_backlog_id uuid; v_payload jsonb; v_resultado jsonb; v_motivo text := nullif(btrim(p_motivo), '');
  v_cliente_alvo uuid;
begin
  if not coalesce((select habilitado from pcm.sso_devolucao_escopo_backlog_gate where id), false) then
    raise exception 'devolucao_desabilitada' using errcode = '55000';
  end if;
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_chamado_id is null or p_parcela_id is null
    or p_alvo_tipo is null or p_alvo_tipo not in ('sistema', 'componente', 'grupo') or p_alvo_id is null
    or v_motivo is null or length(v_motivo) not between 1 and 2000
  then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if config.sso_autorizar_acao('chamado.escopo.gerir', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  -- Mesmo padrão de validação de alvo_tipo/alvo_id já usado em pcm.sso_criar_rotina_rascunho (0261):
  -- aceitar qualquer UUID sem verificar que é um ativo real do Cliente poluiria o Backlog com
  -- composições apontando pra sistema/componente/grupo inexistente ou de outro Cliente.
  if p_alvo_tipo = 'sistema' then
    select s.cliente_id into v_cliente_alvo from pcm.sistemas s where s.id = p_alvo_id and s.ativo and s.deleted_at is null for share;
  elsif p_alvo_tipo = 'componente' then
    select e.client_id into v_cliente_alvo from pcm.equipamentos e where e.id = p_alvo_id and e.ativo and e.deleted_at is null for share;
  else
    select g.cliente_id into v_cliente_alvo from pcm.grupos_quantitativos g where g.id = p_alvo_id and g.ativo and g.deleted_at is null for share;
  end if;
  if v_cliente_alvo is distinct from p_cliente_id then raise exception 'alvo_invalido_ou_de_outro_cliente' using errcode = '23514'; end if;
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'chamadoId', p_chamado_id, 'parcelaId', p_parcela_id,
    'alvoTipo', p_alvo_tipo, 'alvoId', p_alvo_id, 'motivo', v_motivo);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('devolucao-escopo-chamado:' || p_request_id::text, 0));
  select * into v_anterior from pcm.sso_devolucoes_escopo_chamado where request_id = p_request_id;
  if found then
    if v_anterior.ator_id is distinct from v_ator or v_anterior.payload is distinct from v_payload then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return v_anterior.resultado;
  end if;
  if exists(select 1 from pcm.sso_backlog_parcelas where parcela_id = p_parcela_id) then
    raise exception 'parcela_ja_devolvida' using errcode = '23505';
  end if;
  if not exists(
    select 1 from pcm.chamados c where c.id = p_chamado_id and c.cliente_id = p_cliente_id and c.deleted_at is null
  ) then raise exception 'sem_acesso' using errcode = '42501'; end if;
  if not exists(
    select 1 from pcm.sso_suspensoes_chamado s where s.chamado_id = p_chamado_id and s.cliente_id = p_cliente_id and s.estado = 'suspenso'
  ) then raise exception 'chamado_nao_suspenso' using errcode = '23514'; end if;
  select * into v_parcela from pcm.chamado_escopo_parcelas where id = p_parcela_id and chamado_id = p_chamado_id for update;
  if not found or v_parcela.situacao <> 'pendente' then raise exception 'parcela_indisponivel' using errcode = '23514'; end if;
  insert into pcm.sso_backlog_composicoes(cliente_id, alvo_tipo, alvo_id, criado_por)
    values (p_cliente_id, p_alvo_tipo, p_alvo_id, v_ator) returning id into v_composicao_id;
  insert into pcm.sso_backlog_parcelas(pendencia_id, parcela_id, composicao_id, chamado_id, cliente_id, ator_id, request_id, payload, origem)
    values (null, p_parcela_id, v_composicao_id, p_chamado_id, p_cliente_id, v_ator, p_request_id, v_payload, 'chamado_devolvido')
    returning id into v_backlog_id;
  v_resultado := jsonb_build_object('requestId', p_request_id, 'chamadoId', p_chamado_id, 'parcelaId', p_parcela_id,
    'backlogParcelaId', v_backlog_id, 'composicaoId', v_composicao_id);
  insert into pcm.sso_devolucoes_escopo_chamado(request_id, ator_id, cliente_id, chamado_id, parcela_id, backlog_parcela_id, payload, resultado)
    values (p_request_id, v_ator, p_cliente_id, p_chamado_id, p_parcela_id, v_backlog_id, v_payload, v_resultado);
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'chamado.escopo_devolvido_backlog', 'chamado_escopo_parcelas', p_parcela_id, v_resultado || jsonb_build_object('motivo', v_motivo));
  return v_resultado;
end;
$$;
revoke all on function pcm.sso_devolver_parcela_chamado_backlog(uuid, uuid, uuid, uuid, text, uuid, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_devolver_parcela_chamado_backlog(uuid, uuid, uuid, uuid, text, uuid, text) to authenticated;
