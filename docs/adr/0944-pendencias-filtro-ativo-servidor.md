# ADR-0944 — Filtro de Pendências por ativo antes da paginação

Status: preparação local, não homologada.

## Decisão

Adicionar consulta por Cliente e busca literal de nome, tipo ou UUID de ativo, aplicada antes da paginação por ID. Preservar a resposta e a consulta anterior. Usar gate próprio fechado, gate da mediação existente, capacidade `execucao.validar` e trava de autorização antes da leitura; não conceder acesso direto às tabelas. A interface só usa a nova consulta com flag desligada por padrão e deve informar a natureza paginada. Busca vazia retorna todas as Pendências disponíveis.

## Limites e validação

Filtro não prova contagem total, criticidade consolidada nem consistência de páginas concorrentes. Conferir fontes de autorização/revogação, locks, RLS, isolamento, paginação, dados legados e desempenho por Cliente; revisar adversarialmente antes de aplicar ou ativar. Não cria Pendência, composição, Chamado ou OS. Nenhum dado anterior é alterado.
