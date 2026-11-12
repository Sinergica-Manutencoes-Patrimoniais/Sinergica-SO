-- MANUAL; EXECUTAR UMA FEATURE POR VEZ, COM AUTORIZAÇÃO OPERACIONAL, ACOMPANHANDO O RESULTADO.
-- Este script NÃO é parte de migration nenhuma e não roda em deploy. É o procedimento de
-- abertura de gate para a homologação (smoke) em produção.
--
-- ============================================================================================
-- POR QUE ESTE ARQUIVO EXISTE
-- ============================================================================================
-- Publicar a branch em produção NÃO deixa nenhuma feature do SSO testável. Ativar uma feature
-- exige TRÊS camadas independentes, e o deploy entrega só a primeira:
--
--   1. GRANT de execute na RPC  -> entregue pela migration 1839 (já no deploy, nada a fazer).
--   2. GATE no banco             -> este arquivo. Fechado por padrão; só abre por SQL manual.
--   3. FLAG no front (VITE_SSO_*)-> variável de build do Vite. ATENÇÃO: é build-time, então
--                                   mudar a flag exige REBUILD + REDEPLOY do front, não basta
--                                   alterar a variável de ambiente no Netlify.
--
-- Se qualquer uma das três faltar, a tela não funciona:
--   sem grant -> 42501 "permission denied"   (resolvido pela 1839)
--   sem gate  -> 55000 "<feature>_desabilitada"
--   sem flag  -> o componente nem é renderizado
--
-- ============================================================================================
-- COMO ABRIR UM GATE
-- ============================================================================================
-- Nenhum papel da aplicação pode alterar gate: `authenticated` e `service_role` têm UPDATE
-- negado nas tabelas *_gate, de propósito. A abertura só acontece por conexão privilegiada —
-- na prática, o SQL Editor do dashboard do Supabase (roda como `postgres`).
--
-- Abra UM bloco por vez. Rode a verificação. Faça o smoke. Feche de novo (seção final) antes
-- de passar para a próxima feature, para não deixar superfície aberta sem acompanhamento.
--
-- Só constam aqui as features cobertas por pgTAP real nesta branch — ou seja, aquelas em que há
-- evidência de que abrir o gate faz a feature funcionar de verdade. Abrir gate de feature não
-- coberta é decisão de risco separada, fora deste roteiro.

-- ============================================================================================
-- 1) E01-S183 — Portal do síndico: calendário de visitas (somente leitura)
--    Teste: supabase/tests/E01-S183_portal_isolamento_calendario.test.sql
--    Menor risco do conjunto: não escreve nada. Bom primeiro smoke.
-- ============================================================================================
-- begin;
--   update pcm.portal_visita_gate set habilitado = true where id;
--   select 'portal_visita' as gate, habilitado from pcm.portal_visita_gate;
-- commit;

-- ============================================================================================
-- 2) E01-S182 — Vincular comprovante a item faturável
--    Teste: supabase/tests/E01-S182_comprovante_faturavel.test.sql
--    Escreve, mas só cria vínculo entre registros já existentes; nada vira visível ao Cliente.
-- ============================================================================================
-- begin;
--   update financeiro.sso_anexo_faturavel_gate set habilitado = true where id;
--   select 'anexo_faturavel' as gate, habilitado from financeiro.sso_anexo_faturavel_gate;
-- commit;

-- ============================================================================================
-- 3) E01-S167 — Atribuir parcela de escopo direto a uma OS já aberta do mesmo Chamado
--    Teste: supabase/tests/E01-S167_atribuicao_parcela_direta.test.sql
--    Exige os DOIS gates: o específico da atribuição direta e o geral de atribuição.
-- ============================================================================================
-- begin;
--   update pcm.sso_atribuicao_direta_gate   set habilitado = true where id;
--   update pcm.sso_atribuicao_parcela_gate  set habilitado = true where id;
--   select 'atribuicao_direta'  as gate, habilitado from pcm.sso_atribuicao_direta_gate
--   union all
--   select 'atribuicao_parcela' as gate, habilitado from pcm.sso_atribuicao_parcela_gate;
-- commit;

-- ============================================================================================
-- 4) E01-S174 — Atribuir parcela vinda do Backlog a uma OS
--    Teste: supabase/tests/E01-S174_atribuicao_parcela_backlog.test.sql
--    Reusa o gate geral de atribuição (item 3). Se o 3 já está aberto, nada a fazer aqui.
-- ============================================================================================
-- begin;
--   update pcm.sso_atribuicao_parcela_gate set habilitado = true where id;
--   select 'atribuicao_parcela' as gate, habilitado from pcm.sso_atribuicao_parcela_gate;
-- commit;

-- ============================================================================================
-- 5) E01-S182 — Publicar / retirar documento de cobrança no portal do Cliente
--    Testes: E01-S182_publicacao_documento_cobranca.test.sql
--            E01-S182_retirada_documento_cobranca.test.sql
--    MAIOR RISCO DO CONJUNTO: publica documento financeiro visível ao Cliente.
--    Exige os DOIS gates. Faça com um Cliente de teste, nunca com Cliente real no primeiro
--    smoke. A retirada é idempotente e devolve o par para republicação (provado em teste).
-- ============================================================================================
-- begin;
--   update financeiro.sso_documento_cobranca_gate set habilitado = true where id;
--   update pcm.sso_portal_anexo_gate              set habilitado = true where id;
--   select 'documento_cobranca' as gate, habilitado from financeiro.sso_documento_cobranca_gate
--   union all
--   select 'portal_anexo'       as gate, habilitado from pcm.sso_portal_anexo_gate;
-- commit;

-- ============================================================================================
-- 6) E01-S175 — Eventos de origem de campo (Auvo) e conferência PCM
--    Testes: E01-S175_eventos_origem_ordenados.test.sql
--            E01-S175_aplicacao_evento_campo_versionado.test.sql
--    ATENÇÃO: este conjunto liga ingestão vinda do Auvo. Não abra junto com outra feature e
--    confirme antes que não há produtor/cron apontando para produção.
-- ============================================================================================
-- begin;
--   update pcm.origem_campo_inbox_gate           set habilitado = true where id;
--   update pcm.sso_processamento_origem_gate     set habilitado = true where id;
--   update pcm.sso_aplicacao_evento_campo_gate   set habilitado = true where id;
--   update pcm.sso_conferencia_evento_campo_gate set habilitado = true where id;
--   select 'inbox' as gate, habilitado from pcm.origem_campo_inbox_gate
--   union all select 'processamento', habilitado from pcm.sso_processamento_origem_gate
--   union all select 'aplicacao',     habilitado from pcm.sso_aplicacao_evento_campo_gate
--   union all select 'conferencia',   habilitado from pcm.sso_conferencia_evento_campo_gate;
-- commit;

-- ============================================================================================
-- FECHAR TUDO (rollback do smoke) — rode ao terminar, ou a qualquer momento para interromper.
-- Fechar o gate interrompe a feature na hora: as RPCs voltam a responder 55000. Os dados já
-- gravados permanecem (nada aqui apaga registro), e todo histórico do programa é append-only.
-- ============================================================================================
-- begin;
--   update pcm.portal_visita_gate                 set habilitado = false where id;
--   update financeiro.sso_anexo_faturavel_gate    set habilitado = false where id;
--   update pcm.sso_atribuicao_direta_gate         set habilitado = false where id;
--   update pcm.sso_atribuicao_parcela_gate        set habilitado = false where id;
--   update financeiro.sso_documento_cobranca_gate set habilitado = false where id;
--   update pcm.sso_portal_anexo_gate              set habilitado = false where id;
--   update pcm.origem_campo_inbox_gate            set habilitado = false where id;
--   update pcm.sso_processamento_origem_gate      set habilitado = false where id;
--   update pcm.sso_aplicacao_evento_campo_gate    set habilitado = false where id;
--   update pcm.sso_conferencia_evento_campo_gate  set habilitado = false where id;
-- commit;

-- ============================================================================================
-- CONFERÊNCIA GERAL — quantos gates estão abertos em produção agora.
-- O estado normal do programa é ZERO. Rode antes e depois do smoke.
-- ============================================================================================
select count(*) filter (where aberto) as gates_abertos, count(*) as total_gates
from (
  select coalesce((xpath('/r/v/text()',
    query_to_xml(format('select bool_or(habilitado) as v from %I.%I', s, t), false, true, '')))[1]::text::bool, false) as aberto
  from (
    select c.table_schema s, c.table_name t
    from information_schema.columns c
    where c.column_name = 'habilitado' and c.table_name like '%gate%'
      and c.table_schema in ('pcm', 'financeiro', 'comercial', 'config', 'audit')
  ) r
) z;
