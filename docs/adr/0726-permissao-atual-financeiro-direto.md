---
name: "docs-adr-0726-permissao-atual-financeiro-direto-md"
description: "Documento Sinérgica SO: ADR 0726 — Permissão atual em contratos financeiros diretos"
alwaysApply: false
---

# ADR 0726 — Permissão atual em contratos financeiros diretos

## Decisão

Acrescentar políticas RLS restritivas para SELECT, INSERT, UPDATE e DELETE em `financeiro.contratos` para `authenticated`, reutilizando a verificação de módulo atual introduzida em 0949. Leitura requer leitura ou escrita Financeiro; mutações requerem escrita Financeiro. As políticas permissivas anteriores permanecem, de modo que o acesso exige simultaneamente o critério legado e a permissão atual. O FORCE RLS, grants, funções e dados permanecem inalterados.

O helper não retorna dados de contratos e verifica usuário ativo, papel vigente e módulo. Um JWT anterior à concessão ou mudança de papel pode exigir atualização: a transição falha fechada. Service role e rotas security definer têm fronteiras próprias e não são abrangidas por estas políticas; escopo por Cliente e integridade do vínculo Comercial continuam pendentes de análise específica.

## Implantação

Aplicar após 0949 apenas em ambiente revisado; testar autorizações, revogações e compatibilidade em banco isolado. Não habilita consumidores, não homologa e não remove políticas existentes. Para recuo, revisar políticas e risco de restaurar acesso por JWT antigo antes de qualquer remoção.
