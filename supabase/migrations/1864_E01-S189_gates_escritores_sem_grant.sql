-- E01-S189 — dá alcance aos sete escritores que a migration 1839 deixou deliberadamente sem
-- grant: eles escrevem SEM gate de banco (diferente das outras 272 funções da 1839), então dar
-- `execute` a eles diretamente seria liberar a ação sem interruptor para fechar depois.
--
-- Cada função ganha seu próprio gate (fechado por padrão) e um mediador que o consulta antes de
-- delegar ao núcleo. O núcleo permanece revogado de todos os papéis; só o mediador recebe grant.
-- Mesmo padrão de pcm.sso_informar_material_mediado (migration 1061).
--
-- Cada núcleo JÁ faz sua própria checagem de auth.uid()/config.sso_autorizar_acao internamente
-- (conferido migration a migration antes de escrever este arquivo) — o mediador não duplica essa
-- lógica, só acrescenta a camada do gate. Abrir o gate libera a FUNCIONALIDADE; a AUTORIZAÇÃO por
-- ação/Cliente continua sendo decidida pelo núcleo, como sempre foi.
--
-- Reverso:
--   revoke all on function comercial.sso_criar_orcamento_operacional_mediada(uuid,uuid,uuid,integer) from authenticated;
--   revoke all on function config.sso_criar_grupo_atomico_mediada(uuid,uuid,text,text,jsonb,uuid) from authenticated;
--   revoke all on function config.sso_editar_grupo_idempotente_mediada(uuid,uuid,jsonb,jsonb,jsonb,uuid) from authenticated;
--   revoke all on function financeiro.sso_declarar_repasse_despesa_mediada(uuid,uuid,integer,date,text,text) from authenticated;
--   revoke all on function financeiro.sso_publicar_cobranca_os_mediada(uuid,uuid,uuid,text,integer,date,date) from authenticated;
--   revoke all on function pcm.sso_alterar_previsao_visita_mediada(uuid,uuid,integer,text,date,text,bigint,text) from authenticated;
--   revoke all on function pcm.sso_ratear_despesa_visita_mediada(uuid,uuid,integer,jsonb) from authenticated;
--   drop function if exists comercial.sso_criar_orcamento_operacional_mediada(uuid,uuid,uuid,integer);
--   drop function if exists config.sso_criar_grupo_atomico_mediada(uuid,uuid,text,text,jsonb,uuid);
--   drop function if exists config.sso_editar_grupo_idempotente_mediada(uuid,uuid,jsonb,jsonb,jsonb,uuid);
--   drop function if exists financeiro.sso_declarar_repasse_despesa_mediada(uuid,uuid,integer,date,text,text);
--   drop function if exists financeiro.sso_publicar_cobranca_os_mediada(uuid,uuid,uuid,text,integer,date,date);
--   drop function if exists pcm.sso_alterar_previsao_visita_mediada(uuid,uuid,integer,text,date,text,bigint,text);
--   drop function if exists pcm.sso_ratear_despesa_visita_mediada(uuid,uuid,integer,jsonb);
--   drop table if exists comercial.sso_orcamento_operacional_gate;
--   drop table if exists config.sso_grupo_atomico_gate;
--   drop table if exists config.sso_edicao_grupo_gate;
--   drop table if exists financeiro.sso_repasse_despesa_gate;
--   drop table if exists financeiro.sso_cobranca_os_gate;
--   drop table if exists pcm.sso_previsao_visita_gate;
--   drop table if exists pcm.sso_rateio_despesa_visita_gate;

-- ─────────────────────────── SSO-015 · comercial.sso_criar_orcamento_operacional ──────────
create table comercial.sso_orcamento_operacional_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into comercial.sso_orcamento_operacional_gate (id, habilitado) values (true, false);
alter table comercial.sso_orcamento_operacional_gate enable row level security;
alter table comercial.sso_orcamento_operacional_gate force row level security;
revoke all on comercial.sso_orcamento_operacional_gate from public, anon, authenticated, service_role;

create function comercial.sso_criar_orcamento_operacional_mediada(
  p_request_id uuid, p_oportunidade_id uuid, p_lista_id uuid, p_lista_revision integer
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from comercial.sso_orcamento_operacional_gate g where g.id), false) then
    raise exception 'orcamento_operacional_indisponivel' using errcode = '55000';
  end if;
  perform 1 from comercial.sso_orcamento_operacional_gate g where g.id for share;
  if not coalesce((select g.habilitado from comercial.sso_orcamento_operacional_gate g where g.id), false) then
    raise exception 'orcamento_operacional_indisponivel' using errcode = '55000';
  end if;
  return comercial.sso_criar_orcamento_operacional(p_request_id, p_oportunidade_id, p_lista_id, p_lista_revision);
end;
$$;
revoke all on function comercial.sso_criar_orcamento_operacional(uuid, uuid, uuid, integer)
  from public, anon, authenticated, service_role;
revoke all on function comercial.sso_criar_orcamento_operacional_mediada(uuid, uuid, uuid, integer)
  from public, anon, service_role;
grant execute on function comercial.sso_criar_orcamento_operacional_mediada(uuid, uuid, uuid, integer) to authenticated;

-- ─────────────────────────── estrutura · config.sso_criar_grupo_atomico ───────────────────
create table config.sso_grupo_atomico_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into config.sso_grupo_atomico_gate (id, habilitado) values (true, false);
alter table config.sso_grupo_atomico_gate enable row level security;
alter table config.sso_grupo_atomico_gate force row level security;
revoke all on config.sso_grupo_atomico_gate from public, anon, authenticated, service_role;

create function config.sso_criar_grupo_atomico_mediada(
  p_id uuid, p_nome text, p_descricao text, p_permissoes jsonb, p_ator_esperado uuid
) returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from config.sso_grupo_atomico_gate g where g.id), false) then
    raise exception 'grupo_atomico_indisponivel' using errcode = '55000';
  end if;
  perform 1 from config.sso_grupo_atomico_gate g where g.id for share;
  if not coalesce((select g.habilitado from config.sso_grupo_atomico_gate g where g.id), false) then
    raise exception 'grupo_atomico_indisponivel' using errcode = '55000';
  end if;
  perform config.sso_criar_grupo_atomico(p_id, p_nome, p_descricao, p_permissoes, p_ator_esperado);
end;
$$;
revoke all on function config.sso_criar_grupo_atomico(uuid, text, text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function config.sso_criar_grupo_atomico_mediada(uuid, text, text, jsonb, uuid)
  from public, anon, service_role;
grant execute on function config.sso_criar_grupo_atomico_mediada(uuid, text, text, jsonb, uuid) to authenticated;

-- ─────────────────────────── estrutura · config.sso_editar_grupo_idempotente ──────────────
create table config.sso_edicao_grupo_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into config.sso_edicao_grupo_gate (id, habilitado) values (true, false);
alter table config.sso_edicao_grupo_gate enable row level security;
alter table config.sso_edicao_grupo_gate force row level security;
revoke all on config.sso_edicao_grupo_gate from public, anon, authenticated, service_role;

create function config.sso_editar_grupo_idempotente_mediada(
  p_request_id uuid, p_id uuid, p_patch jsonb, p_permissoes jsonb, p_estado_esperado jsonb, p_ator_esperado uuid
) returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from config.sso_edicao_grupo_gate g where g.id), false) then
    raise exception 'edicao_grupo_indisponivel' using errcode = '55000';
  end if;
  perform 1 from config.sso_edicao_grupo_gate g where g.id for share;
  if not coalesce((select g.habilitado from config.sso_edicao_grupo_gate g where g.id), false) then
    raise exception 'edicao_grupo_indisponivel' using errcode = '55000';
  end if;
  perform config.sso_editar_grupo_idempotente(p_request_id, p_id, p_patch, p_permissoes, p_estado_esperado, p_ator_esperado);
end;
$$;
revoke all on function config.sso_editar_grupo_idempotente(uuid, uuid, jsonb, jsonb, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function config.sso_editar_grupo_idempotente_mediada(uuid, uuid, jsonb, jsonb, jsonb, uuid)
  from public, anon, service_role;
grant execute on function config.sso_editar_grupo_idempotente_mediada(uuid, uuid, jsonb, jsonb, jsonb, uuid) to authenticated;

-- ─────────────────────────── SSO-016 · financeiro.sso_declarar_repasse_despesa ────────────
create table financeiro.sso_repasse_despesa_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into financeiro.sso_repasse_despesa_gate (id, habilitado) values (true, false);
alter table financeiro.sso_repasse_despesa_gate enable row level security;
alter table financeiro.sso_repasse_despesa_gate force row level security;
revoke all on financeiro.sso_repasse_despesa_gate from public, anon, authenticated, service_role;

create function financeiro.sso_declarar_repasse_despesa_mediada(
  p_request_id uuid, p_despesa_id uuid, p_expected_revision integer,
  p_competencia date, p_regra_contratual text, p_justificativa text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from financeiro.sso_repasse_despesa_gate g where g.id), false) then
    raise exception 'repasse_despesa_indisponivel' using errcode = '55000';
  end if;
  perform 1 from financeiro.sso_repasse_despesa_gate g where g.id for share;
  if not coalesce((select g.habilitado from financeiro.sso_repasse_despesa_gate g where g.id), false) then
    raise exception 'repasse_despesa_indisponivel' using errcode = '55000';
  end if;
  return financeiro.sso_declarar_repasse_despesa(
    p_request_id, p_despesa_id, p_expected_revision, p_competencia, p_regra_contratual, p_justificativa);
end;
$$;
revoke all on function financeiro.sso_declarar_repasse_despesa(uuid, uuid, integer, date, text, text)
  from public, anon, authenticated, service_role;
revoke all on function financeiro.sso_declarar_repasse_despesa_mediada(uuid, uuid, integer, date, text, text)
  from public, anon, service_role;
grant execute on function financeiro.sso_declarar_repasse_despesa_mediada(uuid, uuid, integer, date, text, text) to authenticated;

-- ─────────────────────────── SSO-016 · pcm.sso_ratear_despesa_visita ──────────────────────
create table pcm.sso_rateio_despesa_visita_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_rateio_despesa_visita_gate (id, habilitado) values (true, false);
alter table pcm.sso_rateio_despesa_visita_gate enable row level security;
alter table pcm.sso_rateio_despesa_visita_gate force row level security;
revoke all on pcm.sso_rateio_despesa_visita_gate from public, anon, authenticated, service_role;

create function pcm.sso_ratear_despesa_visita_mediada(
  p_request_id uuid, p_despesa_id uuid, p_expected_revision integer, p_parcelas jsonb
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_rateio_despesa_visita_gate g where g.id), false) then
    raise exception 'rateio_despesa_indisponivel' using errcode = '55000';
  end if;
  perform 1 from pcm.sso_rateio_despesa_visita_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_rateio_despesa_visita_gate g where g.id), false) then
    raise exception 'rateio_despesa_indisponivel' using errcode = '55000';
  end if;
  return pcm.sso_ratear_despesa_visita(p_request_id, p_despesa_id, p_expected_revision, p_parcelas);
end;
$$;
revoke all on function pcm.sso_ratear_despesa_visita(uuid, uuid, integer, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function pcm.sso_ratear_despesa_visita_mediada(uuid, uuid, integer, jsonb)
  from public, anon, service_role;
grant execute on function pcm.sso_ratear_despesa_visita_mediada(uuid, uuid, integer, jsonb) to authenticated;

-- ─────────────────────────── SSO-016 · pcm.sso_alterar_previsao_visita ───────────────────
create table pcm.sso_previsao_visita_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_previsao_visita_gate (id, habilitado) values (true, false);
alter table pcm.sso_previsao_visita_gate enable row level security;
alter table pcm.sso_previsao_visita_gate force row level security;
revoke all on pcm.sso_previsao_visita_gate from public, anon, authenticated, service_role;

create function pcm.sso_alterar_previsao_visita_mediada(
  p_request_id uuid, p_despesa_id uuid, p_expected_revision integer, p_acao text,
  p_data date, p_descricao text, p_previsto_centavos bigint, p_motivo text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from pcm.sso_previsao_visita_gate g where g.id), false) then
    raise exception 'previsao_visita_indisponivel' using errcode = '55000';
  end if;
  perform 1 from pcm.sso_previsao_visita_gate g where g.id for share;
  if not coalesce((select g.habilitado from pcm.sso_previsao_visita_gate g where g.id), false) then
    raise exception 'previsao_visita_indisponivel' using errcode = '55000';
  end if;
  return pcm.sso_alterar_previsao_visita(
    p_request_id, p_despesa_id, p_expected_revision, p_acao, p_data, p_descricao, p_previsto_centavos, p_motivo);
end;
$$;
revoke all on function pcm.sso_alterar_previsao_visita(uuid, uuid, integer, text, date, text, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function pcm.sso_alterar_previsao_visita_mediada(uuid, uuid, integer, text, date, text, bigint, text)
  from public, anon, service_role;
grant execute on function pcm.sso_alterar_previsao_visita_mediada(uuid, uuid, integer, text, date, text, bigint, text) to authenticated;

-- ─────────────────────────── SSO-017 · financeiro.sso_publicar_cobranca_os ───────────────
create table financeiro.sso_cobranca_os_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into financeiro.sso_cobranca_os_gate (id, habilitado) values (true, false);
alter table financeiro.sso_cobranca_os_gate enable row level security;
alter table financeiro.sso_cobranca_os_gate force row level security;
revoke all on financeiro.sso_cobranca_os_gate from public, anon, authenticated, service_role;

create function financeiro.sso_publicar_cobranca_os_mediada(
  p_request_id uuid, p_lancamento_id uuid, p_os_id uuid, p_descricao_publica text,
  p_valor_esperado integer, p_competencia_esperada date, p_vencimento_esperado date
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not coalesce((select g.habilitado from financeiro.sso_cobranca_os_gate g where g.id), false) then
    raise exception 'cobranca_os_indisponivel' using errcode = '55000';
  end if;
  perform 1 from financeiro.sso_cobranca_os_gate g where g.id for share;
  if not coalesce((select g.habilitado from financeiro.sso_cobranca_os_gate g where g.id), false) then
    raise exception 'cobranca_os_indisponivel' using errcode = '55000';
  end if;
  return financeiro.sso_publicar_cobranca_os(
    p_request_id, p_lancamento_id, p_os_id, p_descricao_publica, p_valor_esperado, p_competencia_esperada, p_vencimento_esperado);
end;
$$;
revoke all on function financeiro.sso_publicar_cobranca_os(uuid, uuid, uuid, text, integer, date, date)
  from public, anon, authenticated, service_role;
revoke all on function financeiro.sso_publicar_cobranca_os_mediada(uuid, uuid, uuid, text, integer, date, date)
  from public, anon, service_role;
grant execute on function financeiro.sso_publicar_cobranca_os_mediada(uuid, uuid, uuid, text, integer, date, date) to authenticated;
