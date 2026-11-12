-- E01-S168 (SSO-003, P0 do Caderno) — agenda o despacho T−24 que até agora não tinha acionador.
--
-- O §11.1 promete "uma tarefa Auvo por OS, disparada em T−24 ou imediatamente se já dentro da
-- janela". A regra inteira existia e estava testada; o que faltava era alguém chamar. A Edge
-- Function `pcm-auvo-t24-despachar` (criada junto com esta migration) é a borda implantável, e
-- este cron é quem a aciona. Sem os dois, a resposta para "o que dispara a orquestração T−24 em
-- produção?" era, literalmente, "nada".
--
-- QUATRO TRAVAS, TODAS FECHADAS POR PADRÃO — ligar o cron NÃO liga o despacho:
--   1. secrets do Vault ausentes  -> esta função é no-op silencioso (mesmo padrão da 0037);
--   2. `SSO_T24_DESPACHAR_ENABLED` != "true" -> a Edge Function responde 503;
--   3. `SSO_T24_CONTRATO_APROVADO_SHA256` sem conferir -> a orquestração recusa com
--      `contrato_nao_comprovado` antes de qualquer efeito remoto (item 16.2-1 do Caderno:
--      enquanto não houver prova de contrato com credencial real do Auvo, não há despacho);
--   4. `SSO_T24_BUSCA_APROVADA_SHA256` sem conferir -> a busca por `externalId` falha fechada e
--      a OS vai para reconciliação, nunca ganha uma 2ª tarefa.
-- O cron existir e não despachar é o estado CORRETO hoje. O que ele resolve é o silêncio: a
-- partir daqui o caminho está ligado de ponta a ponta e o bloqueio fica registrado no ledger,
-- em vez de a feature simplesmente não existir.
--
-- A CADA 15 MINUTOS, não a cada minuto: a janela do §11.1 é de 24 horas e a reserva
-- (`sso_t24_reservar_candidata`) é exclusiva por fence, então granularidade fina não adianta
-- nada e só multiplica chamada ao Auvo. Um lote cobre até 20 OS com prazo de 50s, dentro do
-- limite de execução da Edge Function.
--
-- Reverso:
--   select cron.unschedule('pcm_t24_despachar_15min');
--   drop function if exists pcm.fn_invoke_t24_despachar();

create or replace function pcm.fn_invoke_t24_despachar()
returns void
language plpgsql
security definer
set search_path = pcm, extensions, vault, public
as $$
declare
  v_project_url text;
  v_service_role_key text;
  v_request_id bigint;
begin
  -- Reusa os MESMOS secrets do Vault de 0011/0013/0025/0037 — nenhum segredo novo.
  select decrypted_secret into v_project_url
    from vault.decrypted_secrets where name = 'auvo_trigger_project_url' limit 1;
  select decrypted_secret into v_service_role_key
    from vault.decrypted_secrets where name = 'auvo_trigger_service_role_key' limit 1;

  if v_project_url is null or v_service_role_key is null then
    raise warning 'fn_invoke_t24_despachar: secrets do Vault ausentes — despacho T-24 pulado';
    return;
  end if;

  -- `prazoMs` 50s deixa folga para a Edge Function responder antes do limite de execução;
  -- `limite` 20 é o teto que `processarLoteT24` aceita. Um lote que estoura o prazo para
  -- sozinho e devolve `parada: "prazo"` — o resto fica para a execução seguinte.
  begin
    select net.http_post(
      url := v_project_url || '/functions/v1/pcm-auvo-t24-despachar',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object('limite', 20, 'prazoMs', 50000, 'paginas', 20, 'itensPorPagina', 50)
    ) into v_request_id;
  exception
    when others then
      -- Falhar o job inteiro não ajuda: a próxima execução tenta de novo, e o ledger de
      -- tentativas é quem guarda o que foi ou não confirmado.
      raise warning 'fn_invoke_t24_despachar: falha ao disparar despacho T-24 — %', SQLERRM;
  end;
end;
$$;

revoke all on function pcm.fn_invoke_t24_despachar() from public;

-- `cron.schedule` é idempotente por jobname — reaplicar a migration atualiza, não duplica.
select cron.schedule(
  'pcm_t24_despachar_15min',
  '*/15 * * * *',
  $cron$select pcm.fn_invoke_t24_despachar();$cron$
);

-- ── Verificação (rode após aplicar) ────────────────────────────────────────
-- select jobid, jobname, schedule, command from cron.job where jobname = 'pcm_t24_despachar_15min';
-- select pcm.fn_invoke_t24_despachar();  -- disparo manual (no-op sem os secrets do Vault)
