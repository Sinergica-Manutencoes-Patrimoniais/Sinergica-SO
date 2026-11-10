---
name: "docs-adr-0851-quadro-gerencial-chamados-md"
description: "Documento Sinérgica SO: ADR-0851 — Quadro gerencial paginado por Chamado"
alwaysApply: false
---

# ADR-0851 — Quadro gerencial paginado por Chamado

Estado: proposta local, gates fechados, não homologada. Complementa ADR-0815 e ADR-0834.

O quadro operacional atual é por OS, o que é útil à execução, mas não garante um único card gerencial por Chamado com várias OS. Acrescentar leitura por Cliente, paginada pelo identificador do Chamado, que agrega em lote a união da relação direta e da referência singular unilateral. Não alterar a view ou o quadro de OS existente. Todos os dados de uma página são calculados numa única consulta transacional; páginas diferentes não são uma fotografia global. Se houver vínculo inconsistente em qualquer Chamado da página, a consulta falha fechada, sem indicar progresso falso.

A resposta conserva identidade do Chamado, total, finalizadas e indicação de etapas mistas. Conforme decisão de Fabrício, etapas mistas são apresentadas como “Em andamento”; não se infere aptidão ou encerramento. Status desconhecido não afirma etapas mistas. A interface é opção desligada por padrão, integrada ao contexto de Operação para Cliente selecionado e com detalhe paginado das OS usando a leitura existente. Não substitui nem duplica regra do quadro executável; alterações acionáveis seguem os fluxos existentes.

A função tem gate próprio fechado e EXECUTE apenas ao papel autenticado, com checagem de `chamado.encerrar` por Cliente e bloqueio transacional de autorização. Dados e vínculos não são alterados, e índice/trigger legados permanecem. Testes sintéticos, integração de todas superfícies, concorrência, desempenho com volume real, CI e revisão adversarial são pré-requisitos ao rollout. Esta decisão não habilita criação 1:N ou envio Auvo. Rollback operacional é desligar gate e flag, sem alterar registros.
