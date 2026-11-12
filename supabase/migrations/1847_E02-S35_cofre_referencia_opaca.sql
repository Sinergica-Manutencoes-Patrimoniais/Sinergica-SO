-- 1847_E02-S35_cofre_referencia_opaca.sql — Sinérgica SO
-- Estende o cofre de 0103 (`config.fn_definir_segredo_integracao`, chave fixa tipo 'email') com
-- escrita/leitura/remoção por REFERÊNCIA OPACA E GERAÇÃO (ADR-1686/ADR-0037 do TriviAtende,
-- adaptado): E02-S35 grava N segredos por canal (API key do servidor, token da instância, segredo
-- do webhook) — não cabe no modelo de chave fixa de 0103, que é pra 1 segredo por integração.
--
-- Só `service_role` executa: a Edge Function já roda com service role; não há sessão de browser
-- no caminho de escrita/leitura destes segredos (diferente de 0103, que é chamada direto pelo
-- Admin autenticado). Formato da referência `SINERGICA_<RECURSO>_<GERACAO>_<ID>` é a ÚNICA forma
-- aceita — a função não serve para ler `vault.secrets` por nome livre (não dá pra usá-la para
-- ler 'email' ou 'evolution_api_key' de 0103/evolution-config.ts).
--
-- Reverso:
--   drop function if exists config.fn_remover_segredo_referenciado(text);
--   drop function if exists config.fn_ler_segredo_referenciado(text);
--   drop function if exists config.fn_gravar_segredo_referenciado(text, text);

create or replace function config.fn_gravar_segredo_referenciado(p_ref text, p_valor text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_secret_id uuid;
begin
  if p_ref !~ '^SINERGICA_[A-Z0-9]+_[0-9]+_[0-9a-f]{32}$' then
    raise exception 'referencia_invalida' using errcode = '22023';
  end if;
  if p_valor is null or btrim(p_valor) = '' then
    raise exception 'valor_do_segredo_obrigatorio';
  end if;

  select id into v_secret_id from vault.secrets where name = p_ref;
  if v_secret_id is not null then
    perform vault.update_secret(v_secret_id, p_valor);
  else
    perform vault.create_secret(p_valor, p_ref);
  end if;
end;
$$;

create or replace function config.fn_ler_segredo_referenciado(p_ref text)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_valor text;
begin
  if p_ref !~ '^SINERGICA_[A-Z0-9]+_[0-9]+_[0-9a-f]{32}$' then
    raise exception 'referencia_invalida' using errcode = '22023';
  end if;
  select decrypted_secret into v_valor from vault.decrypted_secrets where name = p_ref;
  return v_valor;
end;
$$;

create or replace function config.fn_remover_segredo_referenciado(p_ref text)
returns void
language plpgsql
security definer
set search_path = public, vault
as $$
begin
  if p_ref !~ '^SINERGICA_[A-Z0-9]+_[0-9]+_[0-9a-f]{32}$' then
    raise exception 'referencia_invalida' using errcode = '22023';
  end if;
  delete from vault.secrets where name = p_ref;
end;
$$;

revoke all on function config.fn_gravar_segredo_referenciado(text, text) from public, anon, authenticated;
revoke all on function config.fn_ler_segredo_referenciado(text)          from public, anon, authenticated;
revoke all on function config.fn_remover_segredo_referenciado(text)      from public, anon, authenticated;

grant execute on function config.fn_gravar_segredo_referenciado(text, text) to service_role;
grant execute on function config.fn_ler_segredo_referenciado(text)          to service_role;
grant execute on function config.fn_remover_segredo_referenciado(text)      to service_role;

comment on function config.fn_gravar_segredo_referenciado(text, text) is
  'E02-S35: grava segredo no Vault sob referência opaca SINERGICA_<RECURSO>_<GERACAO>_<ID32HEX>. service_role apenas.';
comment on function config.fn_ler_segredo_referenciado(text) is
  'E02-S35: lê segredo por referência opaca. Formato recusado = exceção; nunca decripta outro nome.';
comment on function config.fn_remover_segredo_referenciado(text) is
  'E02-S35: remove segredo por referência opaca (rotação/revogação).';
