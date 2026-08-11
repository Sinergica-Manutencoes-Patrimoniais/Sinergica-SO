-- 0189_E03-S06_decisao_proposta.sql — Sinérgica SO
-- Story E03-S06, AC-5/AC-6/AC-7/AC-8. Decisão do síndico (aceite/recusa) sobre a proposta, e o
-- efeito colateral que fecha o funil sozinho — mesmo padrão de `pcm.portal_decidir_orcamento`
-- (E09-S09, migration 0144), com uma diferença deliberada: lá uma segunda decisão RAISE (a
-- requisição já não está mais "pendente"); aqui a spec (AC-8) pede silêncio — segunda decisão é
-- ignorada sem erro, garantido por `unique(proposta_id)` + `on conflict do nothing` no banco, não
-- só na UI.
--
-- Reverso:
--   drop function if exists comercial.fn_decidir_proposta(uuid, text, text);
--   drop table if exists comercial.proposta_decisoes;
--   delete from comercial.motivos_perda where nome = 'Proposta recusada pelo cliente';

-- Motivo dedicado pro win/loss (E03-S08) conseguir separar "recusa formal no portal" dos motivos
-- que o time registra manualmente ao mover o card no funil. `p_motivo` (texto livre do síndico) vai
-- pra `proposta_decisoes.motivo` — o detalhe fica lá; aqui é só a categoria pro dashboard.
insert into comercial.motivos_perda (nome)
values ('Proposta recusada pelo cliente')
on conflict (nome) do nothing;

create table comercial.proposta_decisoes (
  id            uuid        primary key default gen_random_uuid(),
  proposta_id   uuid        not null unique references comercial.propostas (id),
  cliente_id    uuid        not null references pcm.clientes (id),
  decisao       text        not null check (decisao in ('aceita', 'recusada')),
  motivo        text,
  autor_user_id uuid        not null references auth.users,
  ip_hash       text,
  created_at    timestamptz not null default now(),
  check (decisao <> 'recusada' or nullif(btrim(motivo), '') is not null)
);

alter table comercial.proposta_decisoes enable row level security;
alter table comercial.proposta_decisoes force row level security;

grant select on comercial.proposta_decisoes to authenticated;
grant select, insert, update, delete on comercial.proposta_decisoes to service_role;

create policy "proposta_decisoes_select" on comercial.proposta_decisoes for select to authenticated using (
  auth.jwt() ->> 'user_role' = 'superadmin'
  or auth.jwt() -> 'user_modulos' ->> 'comercial' in ('leitura', 'escrita')
  or (
    auth.jwt() ->> 'user_role' = 'cliente-sindico'
    and cliente_id = nullif(auth.jwt() ->> 'cliente_id', '')::uuid
  )
);

comment on table comercial.proposta_decisoes is
  'E03-S06: decisão do síndico sobre a proposta, 1 por proposta (unique). Só a RPC '
  'fn_decidir_proposta escreve — nenhuma policy de insert/update/delete pra authenticated.';

-- ─────────────────────────── AC-5/AC-6/AC-7/AC-8: a RPC ─────────────────────

create or replace function comercial.fn_decidir_proposta(
  p_proposta_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns comercial.propostas
language plpgsql
security definer
set search_path = comercial, pg_temp
as $$
declare
  v_proposta comercial.propostas%rowtype;
  v_cliente_id uuid;
  v_etapa_de uuid;
  v_etapa_para uuid;
  v_motivo_perda_id uuid;
  v_inserida boolean;
begin
  if auth.jwt() ->> 'user_role' <> 'cliente-sindico' then
    raise exception 'somente cliente-sindico decide proposta' using errcode = '42501';
  end if;
  if p_decisao not in ('aceita', 'recusada') then
    raise exception 'decisão inválida: %', p_decisao using errcode = '23514';
  end if;
  if p_decisao = 'recusada' and nullif(btrim(p_motivo), '') is null then
    raise exception 'motivo é obrigatório para recusar' using errcode = '23514';
  end if;

  -- `for update` trava a linha: duas decisões simultâneas (duplo clique) serializam aqui — a
  -- segunda só lê depois que a primeira já commitou o novo status, então cai no caminho idempotente
  -- abaixo, nunca move a oportunidade duas vezes (AC-8), mesmo sem esperar o `on conflict`.
  -- (Variável %rowtype não pode dividir o INTO com outra coluna — daí a Conta em query separada.)
  select p.* into v_proposta from comercial.propostas p where p.id = p_proposta_id for update of p;
  if not found then
    raise exception 'proposta não encontrada' using errcode = '42501';
  end if;

  select o.cliente_id into v_cliente_id
    from comercial.oportunidades o where o.id = v_proposta.oportunidade_id;

  if v_cliente_id is null or v_cliente_id <> nullif(auth.jwt() ->> 'cliente_id', '')::uuid then
    raise exception 'proposta não encontrada' using errcode = '42501';
  end if;

  -- AC-7: proposta vencida nunca é aceita — isto é um ERRO explícito (mensagem pro síndico), bem
  -- diferente do caminho silencioso do AC-8 abaixo (segunda decisão sobre proposta já decidida).
  if p_decisao = 'aceita' and v_proposta.valido_ate is not null and v_proposta.valido_ate < current_date then
    raise exception 'proposta expirada em % — não pode ser aceita', v_proposta.valido_ate
      using errcode = '23514';
  end if;

  -- AC-8: proposta não está mais "enviada" (já decidida antes, ou nunca chegou a ser enviada) —
  -- ignora sem erro, sem mover a oportunidade de novo. O `unique(proposta_id)` na tabela é o
  -- cinto-e-suspensório contra corrida fora desta transação.
  if v_proposta.status <> 'enviada' then
    return v_proposta;
  end if;

  insert into comercial.proposta_decisoes (proposta_id, cliente_id, decisao, motivo, autor_user_id)
  values (p_proposta_id, v_cliente_id, p_decisao, nullif(btrim(p_motivo), ''), auth.uid())
  on conflict (proposta_id) do nothing;
  get diagnostics v_inserida = row_count;
  if not v_inserida then
    -- Corrida rara: outra transação inseriu a decisão entre o SELECT ... FOR UPDATE (que travou a
    -- linha de `propostas`, não a de `proposta_decisoes`, que ainda não existia) e este INSERT.
    return v_proposta;
  end if;

  update comercial.propostas
     set status = case p_decisao when 'aceita' then 'aceita' else 'recusada' end,
         updated_at = now(),
         updated_by = auth.uid()
   where id = p_proposta_id
   returning * into v_proposta;

  -- AC-5/AC-6/degradação (task 8): só move a oportunidade se existir etapa ativa do tipo certo —
  -- funil sem 'ganha'/'perdida' ativa não pode fazer a decisão do cliente se perder (a decisão já
  -- foi gravada acima, o que falta aqui é só o movimento automático do card). `etapa_de` é lido
  -- ANTES do update — é o que vai pro evento como origem do movimento.
  select etapa_id into v_etapa_de from comercial.oportunidades where id = v_proposta.oportunidade_id;

  if p_decisao = 'aceita' then
    select id into v_etapa_para from comercial.etapas_funil
     where tipo = 'ganha' and ativo = true order by ordem limit 1;
    if v_etapa_para is not null then
      update comercial.oportunidades set etapa_id = v_etapa_para
       where id = v_proposta.oportunidade_id;
    end if;
  else
    select id into v_motivo_perda_id from comercial.motivos_perda
     where nome = 'Proposta recusada pelo cliente' and ativo = true limit 1;
    select id into v_etapa_para from comercial.etapas_funil
     where tipo = 'perdida' and ativo = true order by ordem limit 1;
    -- O trigger `fn_oportunidade_fechamento` (0176) exige motivo_perda_id junto de QUALQUER update
    -- que entre em etapa 'perdida' — os dois campos têm que estar disponíveis juntos, senão nem
    -- tenta (ficaria só com a decisão gravada, igual ao caso "sem etapa" mesmo).
    if v_etapa_para is null or v_motivo_perda_id is null then
      v_etapa_para := null;
    else
      update comercial.oportunidades
         set etapa_id = v_etapa_para, motivo_perda_id = v_motivo_perda_id
       where id = v_proposta.oportunidade_id;
    end if;
  end if;

  -- Evento só quando o movimento realmente aconteceu (v_etapa_para não nulo) — degradação (task 8)
  -- não deixa evento fantasma de um movimento que não ocorreu.
  if v_etapa_para is not null then
    insert into comercial.oportunidade_eventos (oportunidade_id, etapa_de, etapa_para, ator_id)
    values (v_proposta.oportunidade_id, v_etapa_de, v_etapa_para, auth.uid());
  end if;

  return v_proposta;
end;
$$;

revoke all on function comercial.fn_decidir_proposta(uuid, text, text) from public;
grant execute on function comercial.fn_decidir_proposta(uuid, text, text) to authenticated;

comment on function comercial.fn_decidir_proposta(uuid, text, text) is
  'E03-S06: aceite/recusa do síndico no portal. security definer com guarda própria (só '
  'cliente-sindico da Conta certa) — grava a decisão, muda o status da proposta e move a '
  'oportunidade pra etapa ganha/perdida quando existir uma ativa (degrada sem perder a decisão '
  'quando não existir). Idempotente por unique(proposta_id) + status check.';
