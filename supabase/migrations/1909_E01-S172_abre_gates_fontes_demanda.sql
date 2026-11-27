-- E01-S172: abre as duas travas de banco que a seção "Fontes de Demanda" (Visão 360 → Estrutura →
-- Capacidade e Agenda, flag VITE_SSO_FONTES_DEMANDA_ENABLED) exige para listar Visitas por semana.
--
-- AUTORIZAÇÃO: dono do projeto, 27/11/2026 — confirmou que as travas NÃO foram abertas à mão em
-- produção e pediu migration.
--
-- O QUE ABRE (só leitura)
--   pcm.capacidade_fontes_mediacao_gate  → pcm.sso_mediar_fontes_demanda_visita (0979)
--   pcm.capacidade_demanda_gate          → pcm.sso_listar_fontes_demanda_visita (0356)
-- Ambas são funções STABLE que só leem, e checam a capacidade 'capacidade.gerir' no Cliente
-- (42501 sem concessão; ser superadmin não dispensa). Nenhum dado de negócio é tocado.
--
-- O QUE FICA FECHADO DE PROPÓSITO
--   pcm.capacidade_esforco_declarado_gate  — destrava o ESCRITOR de esforço declarado e o resumo de
--     esforço (flags VITE_SSO_ESFORCO_DECLARADO_ENABLED / RESUMO_ESFORCO_ENABLED, desligadas).
--   pcm.sso_fila_obrigacoes_preparadas_gate — compartilhada com a jornada E01-S166 (Fila de
--     obrigações preparadas no Plano); abri-la afeta outra jornada e merece decisão própria.
-- A guarda pcm.sso_exigir_fontes_capacidade_autorizadas (1070) só trava essas duas linhas com
-- "for share", sem exigir habilitado; o caminho de demanda não as lê. Abrir cada uma é uma
-- migration própria, junto da flag que a usa.
--
-- REVERSO, a qualquer momento e sem deploy de código:
--   update pcm.capacidade_demanda_gate set habilitado = false where id;
--   update pcm.capacidade_fontes_mediacao_gate set habilitado = false where id;
--
-- Um único bloco "do": a GitHub Integration do Supabase roda cada statement fora de transação
-- (achado do deploy da 1842). Idempotente: reaplicar não é erro.
do $abre$
declare
 v_tabela text;
 v_abertas integer := 0;
 v_linha integer;
 v_alvo text[] := array['pcm.capacidade_fontes_mediacao_gate','pcm.capacidade_demanda_gate'];
begin
 foreach v_tabela in array v_alvo loop
  if pg_catalog.to_regclass(v_tabela) is null then
   raise exception 'trava % ausente: a migration 0356/0979 não foi aplicada', v_tabela using errcode='42P01';
  end if;
  execute pg_catalog.format('update %s set habilitado = true where id and not habilitado', v_tabela);
  get diagnostics v_linha = row_count;
  v_abertas := v_abertas + v_linha;
 end loop;
 raise notice 'E01-S172: % trava(s) aberta(s) nesta execução (de %)', v_abertas, array_length(v_alvo,1);
end
$abre$;
