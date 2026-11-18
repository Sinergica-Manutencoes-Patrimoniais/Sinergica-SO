-- E01-S195 — Deslocamento: enquadramento residencial × operacional.
-- ADR-1693. Aditivo sobre 1357-1359 (E01-S172): aquelas migrations guardam um NÚMERO agregado
-- (minutos_por_pessoa/pessoas_proprias) por revisão da Visita, sem origem/destino. Esta story
-- não edita 1357 (migration aplicada não se edita) — introduz uma entidade nova, "trecho", que
-- decompõe o dia em pernas com origem/destino explícitos. As duas tabelas coexistem: 1357
-- continua sendo a declaração agregada (usada por `sso_listar_deslocamentos_semana` pra somar
-- minutos-homem na capacidade semanal); esta migration soma o COMPUTÁVEL por trecho, que é o
-- enquadramento jurídico que faltava.
--
-- Regra de enquadramento (AC-2/AC-3/AC-4) — pura, função abaixo, nunca armazenada como entrada
-- livre: NÃO COMPUTADO se origem OU destino for 'residencia'; COMPUTADO em qualquer outro par.
-- Cobre os dois casos "trajeto residencial" do pacote (residência→primeiro cliente,
-- último cliente→residência) pela mesma regra, sem precisar saber se é o primeiro/último trecho
-- do dia — e por isso também não existe nenhuma coluna de "veículo sob guarda": a regra não
-- depende disso (AC-2), então nunca dá pra ela mudar o resultado por engano.
--
-- Reverso: revoke execute ...; drop function pcm.sso_declarar_trechos_visita(...);
--          drop function pcm.sso_listar_trechos_visita(uuid,uuid);
--          drop function pcm.sso_enquadrar_trecho_deslocamento(text,text);
--          drop trigger sso_trecho_deslocamento_imutavel on pcm.sso_trechos_deslocamento;
--          drop function pcm.sso_proteger_trecho_deslocamento();
--          drop table pcm.sso_trechos_deslocamento;
--          drop table pcm.sso_trechos_deslocamento_gate;

create table pcm.sso_trechos_deslocamento_gate (
  id boolean primary key default true check (id), habilitado boolean not null default false
);
alter table pcm.sso_trechos_deslocamento_gate enable row level security;
alter table pcm.sso_trechos_deslocamento_gate force row level security;
revoke all on pcm.sso_trechos_deslocamento_gate from public, anon, authenticated, service_role;
insert into pcm.sso_trechos_deslocamento_gate(id, habilitado) values (true, false);

-- AC-1: função pura, sem efeito colateral — o enquadramento nunca é um valor digitado livre,
-- é derivado do par origem/destino em todo caminho (gravação e leitura).
create function pcm.sso_enquadrar_trecho_deslocamento(p_origem text, p_destino text)
returns text language sql immutable set search_path = '' as $$
  select case when p_origem = 'residencia' or p_destino = 'residencia'
    then 'nao_computado' else 'computado' end;
$$;
revoke all on function pcm.sso_enquadrar_trecho_deslocamento(text, text) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_enquadrar_trecho_deslocamento(text, text) to authenticated;

create table pcm.sso_trechos_deslocamento (
  id uuid primary key default gen_random_uuid(),
  -- NÃO único: uma chamada de `sso_declarar_trechos_visita` grava N linhas (1 por trecho do dia)
  -- com o MESMO request_id — é a chave de idempotência do lote inteiro, não de uma linha.
  request_id uuid not null,
  visita_id uuid not null references pcm.visitas(id),
  cliente_id uuid not null references pcm.clientes(id),
  ator_id uuid not null references auth.users(id),
  revisao_visita integer not null check (revisao_visita > 0),
  -- revisão do CONJUNTO de trechos do dia (mesmo padrão de 1357: toda a declaração do dia troca
  -- junto, nunca edição pontual de 1 trecho — AC-8 "valor editado prevalece" vira uma nova
  -- revisão inteira, a sugestão anterior fica no histórico, nunca é apagada).
  revisao integer not null check (revisao > 0),
  sequencia integer not null check (sequencia > 0),
  origem text not null check (origem in ('residencia', 'escritorio', 'visita_anterior', 'visita_proxima', 'outro')),
  destino text not null check (destino in ('residencia', 'escritorio', 'visita_anterior', 'visita_proxima', 'outro')),
  minutos integer not null check (minutos between 0 and 1440),
  enquadramento text not null generated always as (
    pcm.sso_enquadrar_trecho_deslocamento(origem, destino)
  ) stored,
  motivo text check (motivo is null or length(btrim(motivo)) between 1 and 2000),
  criada_em timestamptz not null default now(),
  unique (visita_id, revisao, sequencia)
);
alter table pcm.sso_trechos_deslocamento enable row level security;
alter table pcm.sso_trechos_deslocamento force row level security;
revoke all on pcm.sso_trechos_deslocamento from public, anon, authenticated, service_role;

create function pcm.sso_proteger_trecho_deslocamento() returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'trecho_imutavel' using errcode = '23514';
end; $$;
revoke all on function pcm.sso_proteger_trecho_deslocamento() from public, anon, authenticated, service_role;
create trigger sso_trecho_deslocamento_imutavel before update or delete on pcm.sso_trechos_deslocamento
  for each row execute function pcm.sso_proteger_trecho_deslocamento();

-- AC-1/AC-8/AC-10: grava o dia inteiro de trechos numa revisão atômica. `p_trechos` é um array de
-- objetos `{origem,destino,minutos,motivo}` na ordem do dia (`sequencia` = posição no array).
-- Deslocamento é opcional (AC-10) — não há nenhuma trava que exija isto pra confirmar a Visita;
-- é só mais um dado que pode ser declarado.
create function pcm.sso_declarar_trechos_visita(
  p_request_id uuid, p_cliente_id uuid, p_visita_id uuid, p_revisao_visita integer,
  p_revisao_anterior integer, p_trechos jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_ator uuid := auth.uid(); v_visita pcm.visitas%rowtype;
  v_antigo record; v_revisao integer; v_item jsonb; v_seq integer := 0;
  v_resultado jsonb; v_payload jsonb;
begin
  if v_ator is null or p_request_id is null or p_cliente_id is null or p_visita_id is null
    or p_revisao_visita is null or p_revisao_visita < 1 or p_revisao_anterior is null or p_revisao_anterior < 0
    or p_trechos is null or jsonb_typeof(p_trechos) <> 'array' or jsonb_array_length(p_trechos) < 1
    or jsonb_array_length(p_trechos) > 50 then
    raise exception 'declaracao_invalida' using errcode = '22023';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_trechos_deslocamento_gate where id and habilitado for share;
  if not found then raise exception 'trechos_deslocamento_bloqueados' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-trechos-request:' || p_request_id::text, 0));
  v_payload := jsonb_build_object('clienteId', p_cliente_id, 'visitaId', p_visita_id,
    'revisaoVisita', p_revisao_visita, 'revisaoAnterior', p_revisao_anterior, 'trechos', p_trechos);
  select cliente_id, visita_id, revisao_visita, revisao into v_antigo
    from pcm.sso_trechos_deslocamento where request_id = p_request_id limit 1;
  if found then
    if v_antigo.cliente_id is distinct from p_cliente_id or v_antigo.visita_id is distinct from p_visita_id
      or v_antigo.revisao_visita is distinct from p_revisao_visita then
      raise exception 'request_conflitante' using errcode = '23505';
    end if;
    return jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'visitaId', p_visita_id,
      'revisao', v_antigo.revisao, 'conteudoAutenticado', false);
  end if;
  select * into v_visita from pcm.visitas where id = p_visita_id and cliente_id = p_cliente_id for update;
  if not found then raise exception 'visita_indisponivel' using errcode = '42501'; end if;
  if v_visita.revisao <> p_revisao_visita then raise exception 'revisao_visita_obsoleta' using errcode = '40001'; end if;
  select coalesce(max(revisao), 0) into v_revisao from pcm.sso_trechos_deslocamento where visita_id = p_visita_id;
  if v_revisao <> p_revisao_anterior then raise exception 'revisao_anterior_obsoleta' using errcode = '40001'; end if;
  v_revisao := v_revisao + 1;
  for v_item in select * from jsonb_array_elements(p_trechos) loop
    v_seq := v_seq + 1;
    if v_item ->> 'origem' is null or v_item ->> 'destino' is null or v_item ->> 'minutos' is null
      or jsonb_typeof(v_item -> 'minutos') <> 'number' then
      raise exception 'trecho_invalido' using errcode = '22023';
    end if;
    insert into pcm.sso_trechos_deslocamento(
      request_id, visita_id, cliente_id, ator_id, revisao_visita, revisao, sequencia, origem, destino, minutos, motivo
    ) values (
      p_request_id, p_visita_id, p_cliente_id, v_ator, p_revisao_visita, v_revisao, v_seq,
      v_item ->> 'origem', v_item ->> 'destino', (v_item ->> 'minutos')::integer, nullif(btrim(v_item ->> 'motivo'), '')
    );
  end loop;
  insert into audit.events(actor_id, action, entity, entity_id, payload)
    values (v_ator, 'capacidade.trechos_deslocamento_declarados', 'visitas', p_visita_id,
      v_payload || jsonb_build_object('requestId', p_request_id, 'revisao', v_revisao));
  select jsonb_build_object('requestId', p_request_id, 'clienteId', p_cliente_id, 'visitaId', p_visita_id,
    'revisao', v_revisao, 'conteudoAutenticado', true,
    'totalComputadoMinutos', coalesce(sum(minutos) filter (where enquadramento = 'computado'), 0),
    'totalNaoComputadoMinutos', coalesce(sum(minutos) filter (where enquadramento = 'nao_computado'), 0))
    into v_resultado
    from pcm.sso_trechos_deslocamento where visita_id = p_visita_id and revisao = v_revisao;
  return v_resultado;
end; $$;
revoke all on function pcm.sso_declarar_trechos_visita(uuid,uuid,uuid,integer,integer,jsonb) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_declarar_trechos_visita(uuid,uuid,uuid,integer,integer,jsonb) to authenticated;

-- AC-5/AC-6/AC-7 (parcial, ver SPEC_DEVIATION em plan.md): devolve o total computável da revisão
-- vigente — ocupa jornada (quem consome este número pra capacidade soma, não reduz). NÃO toca em
-- nenhuma tabela de hora contratada do Cliente (não existe uma neste repositório — grep
-- exaustivo antes de codar, ver plan.md) e NÃO classifica hora extra: devolve o minuto bruto,
-- quem decide "é excedente" é o PCM lendo o número, não uma política automática aqui.
create function pcm.sso_listar_trechos_visita(p_cliente_id uuid, p_visita_id uuid)
returns table(
  sequencia integer, origem text, destino text, minutos integer, enquadramento text,
  motivo text, revisao integer, ator_id uuid, criada_em timestamptz, revisao_visita_atual integer
) language plpgsql volatile security definer set search_path = '' as $$
declare v_revisao_visita integer;
begin
  if auth.uid() is null or p_cliente_id is null or p_visita_id is null then raise exception 'parametros_invalidos' using errcode = '22023'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita', 0)) then
    raise exception 'autorizacao_em_alteracao' using errcode = '55P03';
  end if;
  perform 1 from pcm.sso_trechos_deslocamento_gate where id and habilitado for share;
  if not found then raise exception 'trechos_deslocamento_bloqueados' using errcode = '55000'; end if;
  if config.sso_autorizar_acao('capacidade.gerir', p_cliente_id) is distinct from true
    or config.sso_autorizar_acao('visita.confirmar', p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode = '42501'; end if;
  -- E01-S195: a revisão ATUAL da Visita é lida aqui, sempre fresca — mesmo padrão de
  -- `sso_consultar_deslocamento_visita` (1357) — pra quem for declarar em seguida nunca mandar
  -- `p_revisao_visita` desatualizado sem nem saber. `left join` (não `perform`/`return query`
  -- simples) porque sem nenhum trecho ainda a função precisa devolver 1 linha só com a revisão
  -- atual — senão o primeiro envio nunca saberia que revisão da Visita usar.
  select v.revisao into v_revisao_visita from pcm.visitas v where v.id = p_visita_id and v.cliente_id = p_cliente_id for share;
  if not found then raise exception 'visita_indisponivel' using errcode = '42501'; end if;
  return query
    select t.sequencia, t.origem, t.destino, t.minutos, t.enquadramento, t.motivo, t.revisao, t.ator_id, t.criada_em, v_revisao_visita
    from pcm.sso_trechos_deslocamento t
    where t.cliente_id = p_cliente_id and t.visita_id = p_visita_id
      and t.revisao = (select max(t2.revisao) from pcm.sso_trechos_deslocamento t2 where t2.visita_id = p_visita_id)
    order by t.sequencia;
  if not found then
    return query select null::integer, null::text, null::text, null::integer, null::text,
      null::text, null::integer, null::uuid, null::timestamptz, v_revisao_visita;
  end if;
end; $$;
revoke all on function pcm.sso_listar_trechos_visita(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function pcm.sso_listar_trechos_visita(uuid,uuid) to authenticated;
