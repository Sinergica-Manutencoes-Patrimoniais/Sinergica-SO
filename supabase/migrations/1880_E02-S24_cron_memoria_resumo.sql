-- 1880_E02-S24_cron_memoria_resumo.sql — Sinérgica SO
-- Story E02-S24, AC-3. A migration 0159 criou `atendimento.cliente_memoria_resumo` e o
-- `pcm-ze-agent` já LÊ e injeta esse resumo no prompt desde então — mas NADA o preenchia. A
-- tabela estava vazia em produção e o AC-3 era, na prática, uma promessa sem acionador (mesmo
-- sintoma de E01-S168: "o que dispara isso em produção?" — "nada").
--
-- Esta migration entrega as três peças que faltavam, do lado do banco:
--   1. `fn_clientes_para_resumo_memoria` — quem precisa de resumo novo (fila do job);
--   2. `fn_mensagens_para_resumo_memoria` — a transcrição de UM cliente, filtrada no servidor;
--   3. o cron que chama a Edge Function `atendimento-memoria-resumo` (criada nesta story).
--
-- POR QUE A SELEÇÃO É SQL, E NÃO TYPESCRIPT
-- AC-4 (isolamento entre clientes) é requisito de SEGURANÇA. Fazendo o recorte aqui, `p_cliente_id`
-- é obrigatório e a função NUNCA tem um caminho que devolva mensagem de dois clientes na mesma
-- chamada — o isolamento vira propriedade do schema, não disciplina de quem escreve a função
-- Edge. A composição do contexto (`comporContextoCliente`) continua pura em TypeScript.
--
-- JANELA CRUA (30d) × RETENÇÃO (90d)
-- O agente lê cru o último mês (AC-2). O que saiu dessa janela e ainda está dentro de 90 dias
-- vira resumo (AC-3). Mais antigo que 90 dias não entra em contexto nenhum. Os mesmos números
-- vivem em `supabase/functions/_shared/memoria-cliente.ts` (JANELA_CRUA_DIAS/RETENCAO_RESUMO_DIAS)
-- e são passados como parâmetro — o default aqui existe só para chamada manual de diagnóstico.
--
-- SPEC_DEVIATION (retenção): a spec diz "o conteúdo cru antigo é descartado conforme a política de
-- retenção". Esta migration NÃO apaga `atendimento.mensagens`. Apagar histórico real de WhatsApp
-- de cliente é irreversível, é dado de atendimento com valor jurídico/operacional, e nenhuma ADR
-- autoriza isso. "Descarte" aqui é saída do contexto do agente (a mensagem deixa de ser lida),
-- não exclusão física. Exclusão física, se um dia for desejada, precisa de ADR própria.
--
-- Reverso:
--   select cron.unschedule('atendimento_memoria_resumo_diario');
--   drop function if exists atendimento.fn_invoke_memoria_resumo();
--   drop function if exists atendimento.fn_mensagens_para_resumo_memoria(uuid, integer, integer, integer);
--   drop function if exists atendimento.fn_clientes_para_resumo_memoria(integer, integer, integer);

-- ── 1. Fila: de quem o resumo está desatualizado ──────────────────────────────────────────────
-- "Desatualizado" = existe mensagem FORA da janela crua e DENTRO da retenção mais nova que o
-- `periodo_fim` do resumo vigente. Cliente sem resumo nenhum entra na primeira execução
-- (coalesce com '-infinity'). Ordena pelo mais atrasado primeiro, para que um lote curto não
-- deixe sempre os mesmos clientes para trás.
create or replace function atendimento.fn_clientes_para_resumo_memoria(
  p_janela_dias integer default 30,
  p_retencao_dias integer default 90,
  p_limite integer default 20
)
returns table (cliente_id uuid, periodo_inicio timestamptz, periodo_fim timestamptz, total_mensagens bigint)
language sql
stable
security definer
set search_path = atendimento, pcm, public
as $$
  select c.client_id,
         min(m.created_at),
         max(m.created_at),
         count(*)
    from atendimento.conversas c
    join atendimento.mensagens m on m.conversa_id = c.id
   where c.client_id is not null
     and m.conteudo is not null
     and btrim(m.conteudo) <> ''
     and m.created_at <  now() - make_interval(days => p_janela_dias)
     and m.created_at >= now() - make_interval(days => p_retencao_dias)
   group by c.client_id
  having max(m.created_at) > coalesce(
           (select r.periodo_fim from atendimento.cliente_memoria_resumo r
             where r.cliente_id = c.client_id),
           '-infinity'::timestamptz)
   order by max(m.created_at) asc
   limit greatest(p_limite, 0);
$$;

comment on function atendimento.fn_clientes_para_resumo_memoria(integer, integer, integer) is
  'E02-S24 AC-3: clientes cujo resumo rolante está desatualizado — fila do job atendimento-memoria-resumo.';

-- ── 2. Transcrição de UM cliente (AC-4: isolamento imposto pelo schema) ───────────────────────
create or replace function atendimento.fn_mensagens_para_resumo_memoria(
  p_cliente_id uuid,
  p_janela_dias integer default 30,
  p_retencao_dias integer default 90,
  p_limite integer default 400
)
returns table (criado_em timestamptz, autor text, conteudo text)
language sql
stable
security definer
set search_path = atendimento, pcm, public
as $$
  select m.created_at,
         case m.remetente_tipo
           when 'cliente' then 'Cliente'
           when 'humano'  then 'Atendente'
           else 'Zé'
         end,
         m.conteudo
    from atendimento.conversas c
    join atendimento.mensagens m on m.conversa_id = c.id
   where c.client_id = p_cliente_id          -- nunca há caminho sem este filtro
     and p_cliente_id is not null
     and m.conteudo is not null
     and btrim(m.conteudo) <> ''
     and m.created_at <  now() - make_interval(days => p_janela_dias)
     and m.created_at >= now() - make_interval(days => p_retencao_dias)
   order by m.created_at asc
   limit greatest(p_limite, 0);
$$;

comment on function atendimento.fn_mensagens_para_resumo_memoria(uuid, integer, integer, integer) is
  'E02-S24 AC-3/AC-4: transcrição de UM cliente para o resumo rolante. p_cliente_id é obrigatório — o isolamento entre clientes é propriedade desta função, não disciplina do chamador.';

revoke all on function atendimento.fn_clientes_para_resumo_memoria(integer, integer, integer) from public;
revoke all on function atendimento.fn_mensagens_para_resumo_memoria(uuid, integer, integer, integer) from public;
grant execute on function atendimento.fn_clientes_para_resumo_memoria(integer, integer, integer) to service_role;
grant execute on function atendimento.fn_mensagens_para_resumo_memoria(uuid, integer, integer, integer) to service_role;

-- ── 3. Acionador ──────────────────────────────────────────────────────────────────────────────
-- Uma vez por dia, de madrugada: o resumo cobre meses, granularidade fina não muda nada e só
-- multiplica chamada de LLM paga. Sem os secrets do Vault, é no-op silencioso (mesmo padrão de
-- 0013/0037/1844) — o cron existir não liga gasto nenhum sozinho.
create or replace function atendimento.fn_invoke_memoria_resumo()
returns void
language plpgsql
security definer
set search_path = atendimento, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_request_id bigint;
begin
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_invoke_memoria_resumo: secrets do Vault ausentes — resumo de memória pulado';
    return;
  end if;

  begin
    select net.http_post(
      url := v_project_url || '/functions/v1/atendimento-memoria-resumo',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object('limite', 20)
    ) into v_request_id;
  exception
    when others then
      -- Falhar o job inteiro não ajuda: a próxima execução tenta de novo e o resumo vigente
      -- continua válido (caso de borda da spec: falha do job não perde o último resumo bom).
      raise warning 'fn_invoke_memoria_resumo: falha ao disparar resumo de memória — %', SQLERRM;
  end;
end;
$$;

revoke all on function atendimento.fn_invoke_memoria_resumo() from public;

-- `cron.schedule` é idempotente por jobname — reaplicar atualiza, não duplica.
select cron.schedule(
  'atendimento_memoria_resumo_diario',
  '25 4 * * *',
  $cron$select atendimento.fn_invoke_memoria_resumo();$cron$
);

-- ── Verificação (rode após aplicar) ───────────────────────────────────────────────────────────
-- select jobid, jobname, schedule from cron.job where jobname = 'atendimento_memoria_resumo_diario';
-- select * from atendimento.fn_clientes_para_resumo_memoria(30, 90, 20);
-- select atendimento.fn_invoke_memoria_resumo();  -- no-op sem os secrets do Vault
