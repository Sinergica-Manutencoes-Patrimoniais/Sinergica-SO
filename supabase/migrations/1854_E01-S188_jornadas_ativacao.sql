-- E01-S188 — Ativação governada de jornada. Modelo de dados + diagnóstico.
--
-- POR QUE ISTO EXISTE
-- O repositório tem 585 gates de banco e 737 flags VITE_SSO_* (contagem em 2026-11-13). Uma
-- funcionalidade só fica utilizável quando três camadas coincidem: grant na função, gate aberto
-- no banco, flag ligada no build. Faltando qualquer uma, o sintoma é diferente (42501, 55000,
-- componente que não renderiza) para a mesma causa, e não existe hoje nada que responda
-- "esta jornada está utilizável? se não, o que falta?".
--
-- Esta migration NÃO abre nenhum gate. Ela cria o registro declarativo (que requisitos cada
-- jornada tem, em que ordem abrem, como retornam) e a função de diagnóstico que lê o estado real
-- contra esse registro. A abertura/retorno por procedimento vem na 1849.
--
-- Reverso:
--   drop function if exists config.sso_diagnosticar_jornada(text);
--   drop table if exists config.sso_jornada_requisitos;
--   drop table if exists config.sso_jornadas;

create table config.sso_jornadas (
  codigo text primary key,
  titulo text not null check (length(btrim(titulo)) > 0),
  descricao text not null check (length(btrim(descricao)) > 0),
  ativavel boolean not null default true,
  criado_em timestamptz not null default now()
);
alter table config.sso_jornadas enable row level security;
alter table config.sso_jornadas force row level security;
revoke all on config.sso_jornadas from public, anon, authenticated, service_role;

-- `papel`: 'ativacao' é o normal — fecha e abre conforme a decisão de liberar a jornada.
-- 'mecanismo' é diferente: é um requisito cujo estado_alvo já é o estado CORRETO permanente
-- (ex.: pcm.sso_guarda_multiplas_os_gate, que fica aberto depois da migration 1842 — fechá-lo não
-- é "desligar a feature", é reabrir um buraco de segurança). O retorno de jornada nunca mexe em
-- requisito 'mecanismo'.
create table config.sso_jornada_requisitos (
  id uuid primary key default gen_random_uuid(),
  jornada_codigo text not null references config.sso_jornadas(codigo),
  camada text not null check (camada in ('gate', 'flag', 'grant')),
  identificador text not null check (length(btrim(identificador)) > 0),
  papel text not null check (papel in ('ativacao', 'mecanismo')),
  estado_alvo boolean not null,
  ordem integer not null check (ordem > 0),
  motivo text not null check (length(btrim(motivo)) > 0),
  retorno text not null check (length(btrim(retorno)) > 0),
  unique (jornada_codigo, camada, identificador)
);
alter table config.sso_jornada_requisitos enable row level security;
alter table config.sso_jornada_requisitos force row level security;
revoke all on config.sso_jornada_requisitos from public, anon, authenticated, service_role;
create index idx_sso_jornada_requisitos_jornada on config.sso_jornada_requisitos (jornada_codigo, ordem);

-- ─────────────────────────── DIAGNÓSTICO (AC-4, AC-5, AC-6) ───────────────────────────────
--
-- Restrito a superadmin: o mapa de ativação revela a superfície do sistema (quais gates,
-- quais funções, quais flags existem) e não é informação pública nem de papel operacional.
--
-- `camada = 'gate'`: lê a coluna `habilitado` da tabela nomeada em `identificador`
-- (schema.tabela), via `to_regclass` ANTES de montar o SQL dinâmico — identificador que não
-- resolve para uma relação existente vira estado 'inexistente', nunca erro cru nem injeção.
--
-- `camada = 'grant'`: `identificador` é a assinatura completa da função
-- (ex.: 'comercial.sso_criar_orcamento_operacional(uuid,uuid,jsonb)'), resolvida com
-- `to_regprocedure`. Confere `has_function_privilege('authenticated', oid, 'execute')`.
--
-- `camada = 'flag'`: o banco não enxerga o build do front. Lê de
-- `config.sso_flags_publicadas` (criada na 1849, junto com o registrador); sem registro para o
-- build atual, o estado vem como 'declarado' (origem = suposição, não evidência) — é isso que
-- torna AC-6 honesto em vez de fingir saber o que não sabe.
create function config.sso_diagnosticar_jornada(p_codigo text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_jornada config.sso_jornadas%rowtype;
  v_req record;
  v_itens jsonb := '[]'::jsonb;
  v_item jsonb;
  v_estado text;
  v_oid oid;
  v_flags_tabela_existe boolean;
begin
  if not exists (
    select 1 from config.usuarios where user_id = auth.uid() and ativo and papel = 'superadmin'
  ) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;

  select * into v_jornada from config.sso_jornadas where codigo = p_codigo;
  if not found then raise exception 'jornada_inexistente' using errcode = '42501'; end if;

  v_flags_tabela_existe := pg_catalog.to_regclass('config.sso_flags_publicadas') is not null;

  for v_req in
    select * from config.sso_jornada_requisitos where jornada_codigo = p_codigo order by ordem
  loop
    if v_req.camada = 'gate' then
      if pg_catalog.to_regclass(v_req.identificador) is null then
        v_estado := 'inexistente';
      else
        declare v_habilitado boolean;
        begin
          execute pg_catalog.format('select habilitado from %s where id', v_req.identificador)
            into v_habilitado;
          v_estado := case
            when v_habilitado is null then 'inexistente'
            when v_habilitado = v_req.estado_alvo then 'atendido'
            else 'pendente'
          end;
        exception when others then v_estado := 'inexistente';
        end;
      end if;
    elsif v_req.camada = 'grant' then
      v_oid := pg_catalog.to_regprocedure(v_req.identificador);
      if v_oid is null then
        v_estado := 'inexistente';
      else
        v_estado := case
          when has_function_privilege('authenticated', v_oid, 'execute') = v_req.estado_alvo
            then 'atendido'
          else 'pendente'
        end;
      end if;
    else -- flag
      if not v_flags_tabela_existe then
        v_estado := 'declarado';
      else
        declare v_ligada boolean;
        begin
          execute 'select ligada from config.sso_flags_publicadas where nome = $1
                    order by publicado_em desc limit 1'
            into v_ligada using v_req.identificador;
          v_estado := case
            when v_ligada is null then 'declarado'
            when v_ligada = v_req.estado_alvo then 'atendido'
            else 'pendente'
          end;
        end;
      end if;
    end if;

    v_item := jsonb_build_object(
      'camada', v_req.camada, 'identificador', v_req.identificador, 'papel', v_req.papel,
      'estadoAlvo', v_req.estado_alvo, 'estado', v_estado, 'ordem', v_req.ordem,
      'motivo', v_req.motivo
    );
    v_itens := v_itens || jsonb_build_array(v_item);
  end loop;

  return jsonb_build_object(
    'jornada', p_codigo,
    'titulo', v_jornada.titulo,
    'utilizavel', not exists (
      select 1 from jsonb_array_elements(v_itens) i where i->>'estado' in ('pendente', 'inexistente')
    ),
    'faltando', (
      select coalesce(jsonb_agg(i), '[]'::jsonb) from jsonb_array_elements(v_itens) i
      where i->>'estado' in ('pendente', 'inexistente')
    ),
    'itens', v_itens
  );
end;
$$;
revoke all on function config.sso_diagnosticar_jornada(text) from public, anon, service_role;
grant execute on function config.sso_diagnosticar_jornada(text) to authenticated;
