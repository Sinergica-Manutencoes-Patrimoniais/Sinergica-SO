-- 0197_E03-S09_registrar_oportunidade.sql — Sinérgica SO
-- Story E03-S09. `comercial.oportunidades` já nasceu (S01) com TODAS as colunas que o agente
-- precisa — `score`/`resumo`/`origem`/`origem_ref`/`lead_tier`/`cluster_nome`/`conversa_id`/
-- `contato_id` já existem, com os mesmos checks (`score between 0 and 100`,
-- `lead_tier in ('A','B','C','D')`) que a spec pedia como edge case. Esta migration só adiciona o
-- que faltava: idempotência por conversa (AC-6) e etapa de entrada configurável (AC-4).
--
-- Reverso:
--   drop function if exists comercial.fn_registrar_oportunidade(text, text, text, int, text, text, text, text, uuid, uuid, uuid);
--   alter table comercial.etapas_funil drop column if exists entrada_agente;
--   drop index if exists comercial.idx_oportunidades_conversa_aberta;

-- ─────────────────────────── AC-6: idempotência por conversa ────────────────
-- `fechada_em is null` é EXATAMENTE "etapa tipo=aberta" por construção (trigger
-- `fn_oportunidade_fechamento`, 0176, zera/regrava fechada_em toda troca de etapa) — não precisa de
-- join com etapas_funil pra saber se está aberta, e por isso PODE virar índice parcial (predicado
-- de índice parcial só pode referenciar colunas da própria tabela).
create unique index idx_oportunidades_conversa_aberta
  on comercial.oportunidades (conversa_id)
  where conversa_id is not null and fechada_em is null and deleted_at is null;

-- ─────────────────────────── AC-4: etapa de entrada configurável ────────────
alter table comercial.etapas_funil add column if not exists entrada_agente boolean not null default false;

-- No máximo uma etapa marcada — evita duas etapas "de entrada" brigando (config ambígua). Índice
-- parcial no valor constante `entrada_agente` (sempre `true` dentro do filtro) é o idioma padrão
-- do Postgres pra "no máximo uma linha com a flag ligada".
create unique index if not exists idx_etapas_funil_entrada_agente_unica
  on comercial.etapas_funil (entrada_agente)
  where entrada_agente = true;

comment on column comercial.etapas_funil.entrada_agente is
  'E03-S09 AC-4: etapa onde o agente comercial (WhatsApp) registra o lead. No máximo uma marcada '
  '(índice parcial). Fallback quando nenhuma está marcada: a primeira etapa tipo=aberta por ordem.';

-- ─────────────────────────── AC-1..AC-7: a RPC ──────────────────────────────

create or replace function comercial.fn_registrar_oportunidade(
  p_nome text,
  p_telefone text,
  p_score int,
  p_resumo text,
  p_origem_ref text,
  p_lead_tier text,
  p_cluster_nome text,
  p_conversa_id uuid,
  p_contato_id uuid,
  p_created_by uuid
)
returns comercial.oportunidades
language plpgsql
security definer
set search_path = comercial, pg_temp
as $$
declare
  v_cliente_id uuid;
  v_existente comercial.oportunidades%rowtype;
  v_etapa_entrada uuid;
  v_oportunidade comercial.oportunidades%rowtype;
  v_titulo text;
begin
  -- AC-1: só o próprio backend (service_role) chama isto — nunca um usuário autenticado comum,
  -- nem outro módulo por insert direto.
  if not (auth.role() = 'service_role' or current_setting('role', true) = 'service_role') then
    raise exception 'fn_registrar_oportunidade requer service_role' using errcode = '42501';
  end if;

  -- Caso de borda da spec: score fora de 0-100 é recusado pelo check da coluna — mas checar aqui
  -- primeiro dá mensagem melhor que estourar a constraint lá na frente sem contexto.
  if p_score is null or p_score < 0 or p_score > 100 then
    raise exception 'score fora de 0-100: %', p_score using errcode = '23514';
  end if;

  -- AC-6: idempotência — conversa que já tem oportunidade ABERTA (índice parcial acima) atualiza
  -- score/resumo/tier/cluster; se a anterior está FECHADA (ganha/perdida), este SELECT não acha
  -- nada (a condição do índice/da query é "aberta"), e o fluxo segue pra criar uma nova.
  -- `found` checado DENTRO do bloco, logo após o select — checar fora dependeria do valor de FOUND
  -- sobreviver ao `if p_conversa_id is not null`, frágil e não óbvio pra quem ler depois.
  if p_conversa_id is not null then
    select * into v_existente from comercial.oportunidades
     where conversa_id = p_conversa_id and fechada_em is null and deleted_at is null
     for update;
    if found then
      update comercial.oportunidades
         set score = p_score,
             resumo = p_resumo,
             lead_tier = p_lead_tier,
             cluster_nome = p_cluster_nome,
             updated_at = now(),
             updated_by = p_created_by
       where id = v_existente.id
       returning * into v_oportunidade;
      return v_oportunidade;
    end if;
  end if;

  -- AC-2: reusa a Conta pelo vínculo existente do contato; só cria Conta nova quando não há vínculo
  -- nenhum (`auvo_id` fica null — lead nunca vai pro Auvo, é `pcm.clientes` puro).
  if p_contato_id is not null then
    select entidade_id into v_cliente_id
      from relacionamento.vinculos
     where contato_id = p_contato_id and entidade_tipo = 'pcm_cliente'
     order by principal desc, created_at asc
     limit 1;
  end if;

  if v_cliente_id is null then
    -- Caso de borda: contato sem nome — Conta nasce com o identificador disponível (telefone),
    -- nunca com nome vazio.
    insert into pcm.clientes (nome, created_by)
    values (
      coalesce(nullif(btrim(p_nome), ''), nullif(btrim(p_telefone), ''), 'Contato WhatsApp'),
      p_created_by
    )
    returning id into v_cliente_id;

    -- Vínculo novo, pra próxima mensagem deste contato reusar a MESMA Conta (AC-2, "nunca
    -- duplicada") — sem isto, toda mensagem nova criaria uma Conta nova.
    if p_contato_id is not null then
      insert into relacionamento.vinculos (contato_id, entidade_tipo, entidade_id, papel, principal)
      values (p_contato_id, 'pcm_cliente', v_cliente_id, 'lead', true)
      on conflict (contato_id, entidade_tipo, entidade_id) do nothing;
    end if;
  end if;

  -- AC-4: etapa marcada como entrada do agente; sem marcação, a primeira `aberta` por ordem. Se o
  -- funil não tiver NENHUMA etapa aberta, `v_etapa_entrada` fica null e o INSERT abaixo falha na
  -- constraint NOT NULL — erro explícito e logado (o caller isola isso, AC-7), não um valor
  -- inventado.
  select id into v_etapa_entrada from comercial.etapas_funil
   where entrada_agente = true and ativo = true limit 1;
  if v_etapa_entrada is null then
    select id into v_etapa_entrada from comercial.etapas_funil
     where tipo = 'aberta' and ativo = true order by ordem limit 1;
  end if;

  v_titulo := 'Lead WhatsApp — ' || coalesce(nullif(btrim(p_nome), ''), nullif(btrim(p_telefone), ''), 'contato');

  insert into comercial.oportunidades (
    cliente_id, etapa_id, titulo, origem, origem_ref, score, resumo, lead_tier, cluster_nome,
    conversa_id, contato_id, created_by
  ) values (
    v_cliente_id, v_etapa_entrada, v_titulo, 'whatsapp', p_origem_ref, p_score, p_resumo,
    p_lead_tier, p_cluster_nome, p_conversa_id, p_contato_id, p_created_by
  )
  returning * into v_oportunidade;

  return v_oportunidade;
end;
$$;

revoke all on function comercial.fn_registrar_oportunidade(text, text, int, text, text, text, text, uuid, uuid, uuid) from public;
grant execute on function comercial.fn_registrar_oportunidade(text, text, int, text, text, text, text, uuid, uuid, uuid) to service_role;

comment on function comercial.fn_registrar_oportunidade(text, text, int, text, text, text, text, uuid, uuid, uuid) is
  'E03-S09: interface de entrada publicada pelo Comercial pro agente de WhatsApp (ADR-0019 R1/R2) '
  '— substitui o insert direto em comercial.leads. security definer + guarda service_role (AC-1); '
  'idempotente por conversa aberta (AC-6); reusa Conta por vínculo (AC-2); etapa configurável '
  '(AC-4).';
