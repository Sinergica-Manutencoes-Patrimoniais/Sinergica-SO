-- 0126_E01-S81_ia_titulo_os.sql
-- IA (OpenRouter) pra geração de título de OS (AC-1/AC-4). Reusa 100% a tabela/RPCs de Vault já
-- existentes de E00-S12 (`config.integracoes` + `fn_definir_segredo_integracao`/
-- `fn_obter_segredo_integracao_interno`) — só semeia a linha de metadado (chave='openrouter').
-- Único item novo: `fn_integracao_ativa_publica`, uma checagem booleana SEM restrição de
-- superadmin (as duas RPCs de integração existentes — `fn_integracao_tem_segredo` e o próprio
-- select em `config.integracoes` — são superadmin-only; o botão "Gerar título" no form de OS é
-- usado por QUALQUER usuário do PCM, então precisa de um jeito seguro de saber "a IA está
-- ligada?" sem expor segredo nem exigir papel de admin — só um booleano público).
-- Reverso:
--   drop function if exists config.fn_integracao_ativa_publica(text);
--   delete from config.integracoes where chave = 'openrouter';

insert into config.integracoes (chave, provedor, ativo, config_publico)
values ('openrouter', 'openrouter', false, '{"modelo": "openai/gpt-4o-mini"}'::jsonb)
on conflict (chave) do nothing;

create or replace function config.fn_integracao_ativa_publica(p_chave text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from config.integracoes where chave = p_chave and ativo);
$$;

revoke all on function config.fn_integracao_ativa_publica(text) from public;
grant execute on function config.fn_integracao_ativa_publica(text) to authenticated;

comment on function config.fn_integracao_ativa_publica(text)
  is 'E01-S81: checagem booleana pública (nunca exige superadmin, nunca expõe segredo) de "esta integração está ativa?" — pro botão condicionado no client saber se degrada sem precisar acessar config.integracoes direto.';
