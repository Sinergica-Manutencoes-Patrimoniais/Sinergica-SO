-- E01-S188 — abertura e retorno de jornada por procedimento, append-only e idempotente.
--
-- Reverso:
--   drop function if exists config.sso_retornar_jornada(uuid, text, text);
--   drop function if exists config.sso_abrir_jornada(uuid, text, text);
--   drop table if exists config.sso_jornada_eventos;
--   drop function if exists config.sso_registrar_flags_publicadas(text, jsonb);
--   drop table if exists config.sso_flags_publicadas;

-- Estado real das flags VITE_SSO_* por build, alimentado por um passo do pipeline do Netlify
-- (chamado com a service key, fora do alcance de authenticated/anon). Sem isso, o diagnóstico da
-- camada 'flag' na 1848 cai para 'declarado' — suposição, não evidência. Guarda o histórico de
-- builds (não só o último) para permitir auditoria de quando uma flag mudou.
create table config.sso_flags_publicadas (
  id uuid primary key default gen_random_uuid(),
  build text not null check (length(btrim(build)) > 0),
  nome text not null check (nome ~ '^VITE_SSO_[A-Z0-9_]+$'),
  ligada boolean not null,
  publicado_em timestamptz not null default now()
);
alter table config.sso_flags_publicadas enable row level security;
alter table config.sso_flags_publicadas force row level security;
revoke all on config.sso_flags_publicadas from public, anon, authenticated, service_role;
create index idx_sso_flags_publicadas_nome on config.sso_flags_publicadas (nome, publicado_em desc);

create function config.sso_registrar_flags_publicadas(p_build text, p_flags jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare v_item record;
begin
  if p_build is null or length(btrim(p_build)) = 0 or jsonb_typeof(p_flags) is distinct from 'object' then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  for v_item in select * from jsonb_each(p_flags) loop
    if v_item.key !~ '^VITE_SSO_[A-Z0-9_]+$' or jsonb_typeof(v_item.value) is distinct from 'boolean' then
      raise exception 'flag_invalida' using errcode = '22023';
    end if;
    insert into config.sso_flags_publicadas (build, nome, ligada)
      values (p_build, v_item.key, (v_item.value)::text::boolean);
  end loop;
end;
$$;
revoke all on function config.sso_registrar_flags_publicadas(text, jsonb) from public, anon, authenticated;
grant execute on function config.sso_registrar_flags_publicadas(text, jsonb) to service_role;

-- Trilha append-only de abertura/retorno. Um evento por ETAPA (não um por jornada), porque é a
-- granularidade que importa em auditoria: "quem abriu o gate X da jornada Y, quando, por quê".
create table config.sso_jornada_eventos (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  jornada_codigo text not null references config.sso_jornadas(codigo),
  direcao text not null check (direcao in ('abrir', 'retornar')),
  etapa text not null,
  ator_id uuid not null references config.usuarios(user_id),
  motivo text not null check (length(btrim(motivo)) > 0),
  criado_em timestamptz not null default now(),
  unique (request_id, etapa)
);
alter table config.sso_jornada_eventos enable row level security;
alter table config.sso_jornada_eventos force row level security;
revoke all on config.sso_jornada_eventos from public, anon, authenticated, service_role;
create index idx_sso_jornada_eventos_jornada on config.sso_jornada_eventos (jornada_codigo, criado_em desc);

create function config.sso_proteger_jornada_eventos() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'evento_jornada_imutavel' using errcode = '23514';
end;
$$;
revoke all on function config.sso_proteger_jornada_eventos() from public, anon, authenticated, service_role;
create trigger sso_jornada_eventos_imutaveis before update or delete on config.sso_jornada_eventos
  for each row execute function config.sso_proteger_jornada_eventos();

-- ─────────────────────────── ABRIR (AC-7, AC-9) ───────────────────────────────
--
-- Idempotente por request_id: replay com os mesmos (jornada, motivo) é no-op que devolve o
-- mesmo resultado; replay com dado diferente para o mesmo request_id é recusado — mesmo padrão
-- de todo comando mediado do projeto (ver pcm.sso_criar_os_chamado_autorizado).
--
-- AC-9: antes de abrir qualquer gate, roda o diagnóstico. Se faltar 'grant' ou 'flag', recusa —
-- abrir gate sem as outras camadas produziria erro na cara do usuário em vez de funcionalidade.
create function config.sso_abrir_jornada(p_request_id uuid, p_codigo text, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_diagnostico jsonb;
  v_req record;
  v_ja_existe boolean;
  v_etapas jsonb := '[]'::jsonb;
begin
  if v_ator is null or p_request_id is null or p_codigo is null
    or p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not exists (
    select 1 from config.usuarios where user_id = v_ator and ativo and papel = 'superadmin'
  ) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from config.sso_jornadas where codigo = p_codigo and ativavel) then
    raise exception 'jornada_inexistente_ou_nao_ativavel' using errcode = '42501';
  end if;

  select exists(select 1 from config.sso_jornada_eventos where request_id = p_request_id)
    into v_ja_existe;
  if v_ja_existe then
    if exists (
      select 1 from config.sso_jornada_eventos
      where request_id = p_request_id and (jornada_codigo, motivo, direcao) is distinct from (p_codigo, p_motivo, 'abrir')
    ) then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return jsonb_build_object('requestId', p_request_id, 'jornada', p_codigo, 'reutilizado', true);
  end if;

  -- AC-9: só gates de 'ativacao' podem estar pendentes; grant e flag têm que estar prontos ANTES.
  v_diagnostico := config.sso_diagnosticar_jornada(p_codigo);
  if exists (
    select 1 from jsonb_array_elements(v_diagnostico->'faltando') i
    where i->>'camada' in ('grant', 'flag')
  ) then
    raise exception 'ativacao_incompleta' using errcode = '55000';
  end if;

  for v_req in
    select * from config.sso_jornada_requisitos
    where jornada_codigo = p_codigo and camada = 'gate' and papel = 'ativacao'
    order by ordem
  loop
    if pg_catalog.to_regclass(v_req.identificador) is null then
      raise exception 'gate_inexistente' using errcode = '55000';
    end if;
    execute pg_catalog.format('update %s set habilitado = $1 where id', v_req.identificador)
      using v_req.estado_alvo;
    insert into config.sso_jornada_eventos (request_id, jornada_codigo, direcao, etapa, ator_id, motivo)
      values (p_request_id, p_codigo, 'abrir', v_req.identificador, v_ator, p_motivo);
    v_etapas := v_etapas || jsonb_build_array(v_req.identificador);
  end loop;

  return jsonb_build_object('requestId', p_request_id, 'jornada', p_codigo, 'reutilizado', false, 'etapas', v_etapas);
end;
$$;
revoke all on function config.sso_abrir_jornada(uuid, text, text) from public, anon, service_role;
grant execute on function config.sso_abrir_jornada(uuid, text, text) to authenticated;

-- ─────────────────────────── RETORNAR (AC-8) ───────────────────────────────
--
-- Ordem inversa da abertura. NUNCA toca em requisito papel='mecanismo' — é a garantia de que
-- retornar a jornada "Chamado com várias OS" não reabre o buraco de segurança que a migration
-- 1842 fechou (pcm.sso_guarda_multiplas_os_gate tem que continuar aberto para sempre).
-- Não apaga nenhum dado produzido enquanto a jornada esteve aberta — só reverte o gate.
create function config.sso_retornar_jornada(p_request_id uuid, p_codigo text, p_motivo text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid();
  v_req record;
  v_ja_existe boolean;
  v_etapas jsonb := '[]'::jsonb;
begin
  if v_ator is null or p_request_id is null or p_codigo is null
    or p_motivo is null or length(btrim(p_motivo)) = 0 then
    raise exception 'parametros_invalidos' using errcode = '22023';
  end if;
  if not exists (
    select 1 from config.usuarios where user_id = v_ator and ativo and papel = 'superadmin'
  ) then
    raise exception 'sem_acesso' using errcode = '42501';
  end if;
  if not exists (select 1 from config.sso_jornadas where codigo = p_codigo) then
    raise exception 'jornada_inexistente' using errcode = '42501';
  end if;

  select exists(select 1 from config.sso_jornada_eventos where request_id = p_request_id)
    into v_ja_existe;
  if v_ja_existe then
    if exists (
      select 1 from config.sso_jornada_eventos
      where request_id = p_request_id and (jornada_codigo, motivo, direcao) is distinct from (p_codigo, p_motivo, 'retornar')
    ) then
      raise exception 'request_id_conflitante' using errcode = '23505';
    end if;
    return jsonb_build_object('requestId', p_request_id, 'jornada', p_codigo, 'reutilizado', true);
  end if;

  for v_req in
    select * from config.sso_jornada_requisitos
    where jornada_codigo = p_codigo and camada = 'gate' and papel = 'ativacao'
    order by ordem desc
  loop
    if pg_catalog.to_regclass(v_req.identificador) is null then
      raise exception 'gate_inexistente' using errcode = '55000';
    end if;
    execute pg_catalog.format('update %s set habilitado = false where id', v_req.identificador);
    insert into config.sso_jornada_eventos (request_id, jornada_codigo, direcao, etapa, ator_id, motivo)
      values (p_request_id, p_codigo, 'retornar', v_req.identificador, v_ator, p_motivo);
    v_etapas := v_etapas || jsonb_build_array(v_req.identificador);
  end loop;

  return jsonb_build_object('requestId', p_request_id, 'jornada', p_codigo, 'reutilizado', false, 'etapas', v_etapas);
end;
$$;
revoke all on function config.sso_retornar_jornada(uuid, text, text) from public, anon, service_role;
grant execute on function config.sso_retornar_jornada(uuid, text, text) to authenticated;

-- ─────────────────────────── AS DUAS JORNADAS DO PILOTO ───────────────────────────────
--
-- SSO-003 (despacho T-24) não entra aqui: suas travas reais (secrets do Edge Function,
-- impressões digitais de contrato) vivem no runtime Deno, fora do alcance de SQL — declarar como
-- 'gate'/'flag'/'grant' seria forçar um encaixe que o diagnóstico não consegue verificar de
-- verdade. Registrar quando houver um jeito honesto de ler esse estado.

insert into config.sso_jornadas (codigo, titulo, descricao) values
  ('chamado-multiplas-os', 'Chamado com várias OS',
   'Permite abrir mais de uma OS para o mesmo Chamado (SSO-001, migration 1842). O corte estrutural já está em produção; esta jornada controla a liberação da UI.'),
  ('central-materiais', 'Central de Materiais — eventos mediados',
   'Libera os eventos de disponibilidade/exceção/aquisição/dispensa/conclusão da lista de materiais (SSO-013, migration 1843).');

insert into config.sso_jornada_requisitos
  (jornada_codigo, camada, identificador, papel, estado_alvo, ordem, motivo, retorno)
values
  ('chamado-multiplas-os', 'gate', 'pcm.sso_criacao_os_mediada_gate', 'ativacao', true, 1,
   'libera o caminho mediado de criação de OS a partir do Chamado',
   'fechar este gate volta a recusar a criação mediada de OS'),
  ('chamado-multiplas-os', 'gate', 'pcm.chamado_os_gate', 'ativacao', true, 2,
   'gate de feature: permite múltiplas OS visíveis/operáveis pela UI',
   'fechar este gate impede nova OS adicional pela UI, sem afetar as já criadas'),
  -- ordem=99: requisito 'mecanismo' nunca entra no loop de abrir/retornar (que filtra
  -- papel='ativacao'), então a ordem aqui é só informativa — colocado por último de propósito,
  -- para não sugerir que participa da sequência operacional.
  ('chamado-multiplas-os', 'gate', 'pcm.sso_guarda_multiplas_os_gate', 'mecanismo', true, 99,
   'mecanismo de proteção que substituiu o índice legado único na migration 1842 — precisa ficar SEMPRE aberto',
   'NUNCA fechar: fechá-lo sem o índice legado é o estado inseguro que a guarda existe para evitar'),
  ('chamado-multiplas-os', 'grant', 'pcm.sso_criar_os_chamado_autorizado(uuid,bigint,uuid,uuid,uuid,text,text,text)', 'ativacao', true, 3,
   'authenticated precisa de execute na função que cria a OS adicional',
   'revogar o grant torna a função inalcançável pela UI'),
  ('chamado-multiplas-os', 'flag', 'VITE_SSO_CRIAR_OS_CHAMADO_ENABLED', 'ativacao', true, 4,
   'flag de build que renderiza o formulário de criar OS no Chamado',
   'desligar e republicar remove o formulário da interface'),

  ('central-materiais', 'gate', 'pcm.sso_eventos_materiais_mediados_gate', 'ativacao', true, 1,
   'libera os eventos mediados de disponibilidade/exceção/aquisição/dispensa/conclusão',
   'fechar este gate volta a recusar todo evento novo de material'),
  ('central-materiais', 'grant', 'pcm.sso_informar_material_mediado(uuid,uuid,integer,text,jsonb)', 'ativacao', true, 2,
   'authenticated precisa de execute na função mediada que registra os eventos',
   'revogar o grant torna a função inalcançável pela UI'),
  ('central-materiais', 'flag', 'VITE_SSO_LISTAS_MATERIAIS_ENABLED', 'ativacao', true, 3,
   'flag de build que renderiza o bloco de materiais dentro da OS',
   'desligar e republicar remove o bloco da interface');
