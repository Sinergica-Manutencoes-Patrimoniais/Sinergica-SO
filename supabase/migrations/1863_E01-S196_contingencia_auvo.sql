-- E01-S196 AC-9/AC-10/AC-11 — "Gatilho único do Auvo": a metade difícil (acionador T−24,
-- 1844_E01-S168_cron_despacho_t24.sql + Edge Function pcm-auvo-t24-despachar) já existia e está
-- testada (AC-1 a AC-8 reusam essa mecânica, ver plan.md — "não reimplementar" por achado desta
-- story). O que faltava era fechar os GATILHOS CONCORRENTES: `pcm-auvo-open-task` (botão "Abrir no
-- Auvo") só exigia módulo 'pcm' escrita genérico — qualquer escritor contornava o fluxo único sem
-- capacidade própria, sem motivo, sem auditoria. Vira contingência de verdade aqui.
--
-- Achado: a criação AUTOMÁTICA concorrente (`pcm-auvo-create-task`, trigger em `planejamento`)
-- já tem trava própria (`SSO_BLOQUEAR_ENVIO_LEGADO_AUVO`, env var, "true" bloqueia) — é uma trava
-- de rollout, não de capacidade; não há contingência ali porque não é um caminho humano. Esta
-- migration cobre só o caminho humano (`pcm-auvo-open-task`/"Abrir no Auvo").
--
-- Reverso: revoke execute ...; drop function pcm.sso_registrar_contingencia_auvo(...);
--          drop function pcm.sso_autorizar_contingencia_auvo(uuid);
--          delete from config.sso_acoes where codigo = 'execucao.contingencia_auvo';
--          (nunca sem preservar audit.events já gravados — histórico fica, só a capacidade fecha)

insert into config.sso_acoes (codigo, modulo, exige_concessao_individual) values
  ('execucao.contingencia_auvo', 'pcm', true)
on conflict (codigo) do nothing;

-- AC-10: checagem isolada, chamável pelo front ANTES de abrir o formulário (UX: não deixa
-- preencher motivo pra depois recusar) — mas o servidor nunca confia só nisso, ver
-- sso_registrar_contingencia_auvo abaixo, que re-checa.
create function pcm.sso_autorizar_contingencia_auvo(p_cliente_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(config.sso_autorizar_acao('execucao.contingencia_auvo', p_cliente_id), false);
$$;
revoke all on function pcm.sso_autorizar_contingencia_auvo(uuid) from public, anon;
grant execute on function pcm.sso_autorizar_contingencia_auvo(uuid) to authenticated;

create table pcm.sso_contingencias_auvo (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  os_id uuid not null references pcm.ordens_servico(id),
  cliente_id uuid not null references pcm.clientes(id),
  ator_id uuid not null references auth.users(id),
  motivo text not null check (length(btrim(motivo)) between 1 and 2000),
  criada_em timestamptz not null default now()
);
alter table pcm.sso_contingencias_auvo enable row level security;
alter table pcm.sso_contingencias_auvo force row level security;
revoke all on pcm.sso_contingencias_auvo from public, anon, authenticated, service_role;

-- AC-9: capacidade própria, motivo obrigatório, auditado. Chamada pela Edge Function
-- `pcm-auvo-open-task` com um client no contexto do USUÁRIO (não service_role) — é o que faz
-- `auth.uid()` aqui dentro ser o ator real, não o sistema. Idempotente por request_id: reabrir o
-- mesmo modal e reenviar o mesmo pedido nunca grava duas linhas de auditoria pro mesmo evento.
create function pcm.sso_registrar_contingencia_auvo(p_request_id uuid, p_cliente_id uuid, p_os_id uuid, p_motivo text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_ator uuid := auth.uid(); v_motivo text := nullif(btrim(p_motivo), ''); v_antiga pcm.sso_contingencias_auvo%rowtype; v_id uuid;
begin
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_os_id is null
    or v_motivo is null or length(v_motivo) > 2000 then
    raise exception 'contingencia_invalida' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  if config.sso_autorizar_acao('execucao.contingencia_auvo', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from pcm.ordens_servico o where o.id = p_os_id and o.client_id = p_cliente_id and o.deleted_at is null) then
    raise exception 'os_indisponivel' using errcode = '42501';
  end if;
  select * into v_antiga from pcm.sso_contingencias_auvo where request_id = p_request_id;
  if found then
    if v_antiga.ator_id is distinct from v_ator or v_antiga.cliente_id is distinct from p_cliente_id
      or v_antiga.os_id is distinct from p_os_id or v_antiga.motivo is distinct from v_motivo then
      raise exception 'request_conflitante' using errcode = '23505';
    end if;
    return v_antiga.id;
  end if;
  insert into pcm.sso_contingencias_auvo(request_id, os_id, cliente_id, ator_id, motivo)
    values (p_request_id, p_os_id, p_cliente_id, v_ator, v_motivo) returning id into v_id;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'execucao.contingencia_auvo_usada', 'ordens_servico', p_os_id,
      jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'osId', p_os_id, 'motivo', v_motivo));
  return v_id;
end; $$;
revoke all on function pcm.sso_registrar_contingencia_auvo(uuid,uuid,uuid,text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_registrar_contingencia_auvo(uuid,uuid,uuid,text) to authenticated;

-- AC-11 (parcial — ver SPEC_DEVIATION em plan.md): expõe só a leitura de "uso de contingência"
-- — uma das quatro categorias do monitor de exceções pedido pela spec. As outras três (Visita
-- não confirmada, falha de envio, tarefa órfã) não têm consulta consolidada ainda; consolidar as
-- quatro no mesmo lugar é trabalho de UI maior que não coube nesta story (achado registrado).
create function pcm.sso_listar_contingencias_auvo(p_cliente_id uuid, p_apos uuid, p_limite integer)
returns table(id uuid, os_id uuid, motivo text, ator_id uuid, criada_em timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or p_cliente_id is null or p_limite is null or p_limite not between 1 and 100 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if config.sso_autorizar_acao('execucao.contingencia_auvo', p_cliente_id) is distinct from true then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  return query select c.id, c.os_id, c.motivo, c.ator_id, c.criada_em
    from pcm.sso_contingencias_auvo c
    where c.cliente_id = p_cliente_id and (p_apos is null or c.id > p_apos)
    order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_contingencias_auvo(uuid,uuid,integer) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_contingencias_auvo(uuid,uuid,integer) to authenticated;
