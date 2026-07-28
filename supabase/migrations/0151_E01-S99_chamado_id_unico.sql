-- 0151_E01-S99_chamado_id_unico.sql — Sinérgica SO
-- Story E01-S99 / ADR-0014. Reverte a numeração própria de OS introduzida em E01-S88 (0133):
-- o Chamado (`CH-XXXX`) volta a ser o identificador único de ponta a ponta. A OS deixa de gerar
-- `OS-XXXX` — quando nasce de um Chamado, herda o número dele via trigger; quando nasce sem
-- Chamado prévio (Auvo direto, WhatsApp, Portal do Cliente), um Chamado é criado primeiro (mesmo
-- padrão já usado pela criação manual via `pcm.chamados`), e a OS referencia esse `chamado_id`.
-- Precedente: antes de E01-S88, `pcm.ordens_servico.numero` já era `CH-001, CH-002…` (comentário
-- original em 0001_E00-S00_schemas_dominio.sql) — esta migration não inventa um esquema novo, só
-- volta ao que era antes, agora com o Chamado como entidade própria por trás do número.
--
-- Reverso:
--   create sequence if not exists pcm.seq_ordens_servico_numero;
--   grant usage on sequence pcm.seq_ordens_servico_numero to authenticated, service_role;
--   create or replace function pcm.fn_proximo_numero_os() returns text language sql as $$
--     select 'OS-' || lpad(nextval('pcm.seq_ordens_servico_numero')::text, 4, '0');
--   $$;
--   create or replace function pcm.fn_proximos_numeros_os(p_quantidade int) returns text[] language sql as $$
--     select coalesce(array_agg('OS-' || lpad(nextval('pcm.seq_ordens_servico_numero')::text, 4, '0')), array[]::text[])
--     from generate_series(1, greatest(p_quantidade, 0));
--   $$;
--   grant execute on function pcm.fn_proximo_numero_os() to authenticated, service_role;
--   grant execute on function pcm.fn_proximos_numeros_os(int) to authenticated, service_role;
--   drop trigger if exists trg_ordens_servico_numero_chamado on pcm.ordens_servico;
--   drop function if exists pcm.fn_ordens_servico_sync_numero_chamado();
--   drop function if exists pcm.fn_proximos_numeros_chamado(int);
--   alter table pcm.chamados drop constraint chamados_origem_check;
--   alter table pcm.chamados add constraint chamados_origem_check
--     check (origem in ('manual', 'cliente_portal', 'whatsapp', 'inspecao'));
--   -- + restaurar `pcm.portal_decidir_orcamento` pra versão de 0149_security_db_ci_hardening.sql
--   --   (numeração via fn_proximo_numero_os, sem criar Chamado).

-- AC-3 (nova origem pra Chamado nascido automaticamente de um evento do Auvo, sem interação
-- humana prévia — task criada direto no app Auvo e sincronizada via webhook/import em lote).
-- NOT VALID aqui, VALIDATE em migration separada (mesmo padrão de 0134/`chamado_id`) — evita
-- bloquear leituras/escritas em `pcm.chamados` com o scan de validação na mesma transação.
alter table pcm.chamados drop constraint chamados_origem_check;
alter table pcm.chamados add constraint chamados_origem_check
  check (origem in ('manual', 'cliente_portal', 'whatsapp', 'inspecao', 'auvo_sync')) not valid;

-- Reserva em lote de números de Chamado — mesmo padrão de `fn_proximos_numeros_os` (0133, agora
-- descontinuada), usado pelo backfill/reconciliação em lote do Auvo (`pcm-auvo-tasks-import`), que
-- precisa de N números sem N round-trips.
create or replace function pcm.fn_proximos_numeros_chamado(p_quantidade int)
returns text[]
language sql
as $$
  select coalesce(
    array_agg('CH-' || lpad(nextval('pcm.seq_chamados_numero')::text, 4, '0')),
    array[]::text[]
  )
  from generate_series(1, greatest(p_quantidade, 0));
$$;

grant execute on function pcm.fn_proximos_numeros_chamado(int) to authenticated, service_role;

-- AC-1/AC-2: toda OS que nasce com `chamado_id` preenchido herda o número do Chamado — o valor
-- que o chamador eventualmente informar em `numero` é sempre sobrescrito aqui, é a fonte única de
-- verdade (evita 4 pontos de código duplicando a mesma regra). Sem `chamado_id` (caminho legado
-- ainda não migrado), o `numero` explícito do chamador é respeitado — sem quebrar caminhos não
-- identificados nesta story.
create or replace function pcm.fn_ordens_servico_sync_numero_chamado()
returns trigger
language plpgsql
as $$
declare
  v_numero text;
begin
  if new.chamado_id is not null then
    select numero into v_numero from pcm.chamados where id = new.chamado_id;
    if v_numero is null then
      raise exception 'Chamado % não encontrado para vincular a OS', new.chamado_id;
    end if;
    new.numero := v_numero;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ordens_servico_numero_chamado on pcm.ordens_servico;
create trigger trg_ordens_servico_numero_chamado
  before insert on pcm.ordens_servico
  for each row execute function pcm.fn_ordens_servico_sync_numero_chamado();

-- Portal do Cliente aprovando orçamento também passa a criar o Chamado primeiro (origem
-- 'cliente_portal') em vez de numerar a OS direto — mesmo racional dos outros 3 caminhos
-- (web manual, Auvo, WhatsApp/Zé) tratados no código desta story. Redefine a versão vigente
-- (última `create or replace` era em 0149_security_db_ci_hardening.sql).
create or replace function pcm.portal_decidir_orcamento(
  p_orcamento_id uuid,
  p_decisao text,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_orc pcm.orcamentos_servico%rowtype;
  v_req pcm.requisicoes_servico%rowtype;
  v_os_id uuid;
  v_chamado_id uuid;
  v_chamado_numero text;
  v_actor uuid := auth.uid();
  v_cliente_id uuid;
begin
  if v_actor is null
     or auth.jwt() ->> 'user_role' is distinct from 'cliente-sindico'
     or nullif(auth.jwt() ->> 'cliente_id', '') is null then
    raise exception 'somente_cliente_sindico' using errcode = '42501';
  end if;
  v_cliente_id := (auth.jwt() ->> 'cliente_id')::uuid;

  if p_decisao not in ('aprovado','recusado') then
    raise exception 'decisao_invalida' using errcode = '23514';
  end if;
  if p_decisao = 'recusado' and nullif(btrim(p_motivo), '') is null then
    raise exception 'motivo_recusa_obrigatorio' using errcode = '23514';
  end if;

  select * into v_orc
  from pcm.orcamentos_servico
  where id = p_orcamento_id
  for update;
  if not found or v_orc.cliente_id is distinct from v_cliente_id then
    raise exception 'orcamento_nao_encontrado' using errcode = '42501';
  end if;
  if v_orc.status <> 'pendente' or (v_orc.valido_ate is not null and v_orc.valido_ate < current_date) then
    raise exception 'orcamento_nao_decidivel' using errcode = '23514';
  end if;

  insert into pcm.orcamento_decisoes (orcamento_id, cliente_id, decisao, motivo, autor_user_id)
  values (v_orc.id, v_orc.cliente_id, p_decisao, nullif(btrim(p_motivo), ''), v_actor);

  update pcm.orcamentos_servico
  set status = p_decisao, updated_at = now(), updated_by = v_actor
  where id = v_orc.id;

  update pcm.requisicoes_servico
  set status = case p_decisao when 'aprovado' then 'aceita' else 'recusada' end
  where id = v_orc.requisicao_id
  returning * into v_req;

  if p_decisao = 'aprovado' then
    v_chamado_numero := pcm.fn_proximo_numero_chamado();
    insert into pcm.chamados (numero, cliente_id, titulo, descricao, origem, status, created_by, updated_by)
    values (
      v_chamado_numero, v_orc.cliente_id, v_orc.titulo,
      coalesce(v_orc.descricao, v_req.descricao), 'cliente_portal', 'aberto', v_actor, v_actor
    ) returning id into v_chamado_id;

    insert into pcm.chamados_eventos (chamado_id, tipo, metadata, created_by)
    values (v_chamado_id, 'criado', jsonb_build_object('numero', v_chamado_numero, 'auto', true, 'orcamento_id', v_orc.id), v_actor);

    insert into pcm.ordens_servico (
      client_id, chamado_id, numero, titulo, descricao, categoria, status, prioridade,
      origem, origem_ref_id, created_by
    ) values (
      v_orc.cliente_id, v_chamado_id, v_chamado_numero, v_orc.titulo,
      coalesce(v_orc.descricao, v_req.descricao), 'corretiva', 'solicitacao', 'normal',
      'portal', v_orc.id::text, v_actor
    ) returning id into v_os_id;

    update pcm.orcamentos_servico set ordem_servico_id = v_os_id where id = v_orc.id;

    update pcm.chamados
    set status = 'convertido_os', ordem_servico_id = v_os_id, updated_at = now(), updated_by = v_actor
    where id = v_chamado_id;

    insert into pcm.chamados_eventos (chamado_id, tipo, metadata, created_by)
    values (v_chamado_id, 'os_gerada', jsonb_build_object('ordemServicoId', v_os_id), v_actor);
  end if;

  return v_os_id;
end;
$$;

revoke all on function pcm.portal_decidir_orcamento(uuid, text, text) from public;
grant execute on function pcm.portal_decidir_orcamento(uuid, text, text) to authenticated;

-- Descontinua a numeração própria de OS (E01-S88/0133) — todos os chamadores em código já migram
-- pra criar/referenciar um Chamado nesta mesma story (os-from-task.ts, supabase-ordem-servico-
-- adapter.ts, pcm-ze-agent, portal_decidir_orcamento acima).
drop function if exists pcm.fn_proximos_numeros_os(int);
drop function if exists pcm.fn_proximo_numero_os();
drop sequence if exists pcm.seq_ordens_servico_numero;
