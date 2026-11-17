-- E01-S190 AC-2 — PMOC vira uma modalidade do Plano de Manutenção, com campos, documentos,
-- responsabilidades e exigências legais próprias (decisão do Fabrício, resposta 26, 17/11/2026).
-- Não mantém módulo nem cadastro independentes que dupliquem o Plano.
--
-- Reverso: alter table pcm.planos_manutencao drop constraint if exists planos_manutencao_modalidade_check;
--          alter table pcm.planos_manutencao drop column if exists modalidade;
--
-- O QUE ISTO FAZ (e o que NÃO faz)
-- Só a coluna, aditiva e nullable — fundação pra classificar QUAL Plano é PMOC, sem tocar no
-- schema PMOC em si (`pcm.pmoc_*`, 0023 e descendentes) nem na engenharia de reconciliação já
-- construída em E01-S166 (`sso_vinculos_ciclo_pmoc`, `sso_listar_obrigacoes_pmoc_plano` e afins,
-- que já ligam PMOC a `pcm.planos_manutencao` via `plano_id` — ver 1631-1642). `PmocPage.tsx`
-- continua sendo a visão filtrada de hoje; a página não muda nesta story.
--
-- NÃO faz backfill. Decidir QUAIS `planos_manutencao` existentes são PMOC exigiria auditar a
-- engenharia de reconciliação do E01-S166 cliente a cliente — é trabalho de domínio, não de
-- reorganização de menu (fora do escopo desta story: "reescrever regra de negócio de Plano ou
-- PMOC"). Quem criar ou reclassificar um Plano PMOC de agora em diante grava a modalidade; os
-- planos já vinculados por E01-S166 ficam sem o rótulo até uma story de classificação própria —
-- registrado aqui como pendência explícita, não escondida.
alter table pcm.planos_manutencao
  add column if not exists modalidade text;

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_constraint
    where conname = 'planos_manutencao_modalidade_check'
  ) then
    alter table pcm.planos_manutencao
      add constraint planos_manutencao_modalidade_check
      check (modalidade is null or modalidade in ('pmoc'));
  end if;
end $$;
