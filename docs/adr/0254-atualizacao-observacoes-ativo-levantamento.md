---
name: "docs-adr-0254-atualizacao-observacoes-ativo-levantamento-md"
description: "Documento Sinérgica SO: ADR-0254 — Atualização conservadora de observações de ativos"
alwaysApply: false
---

# ADR-0254 — Atualização conservadora de observações de ativos

## Decisão

Preparar comando privado para incorporar, após conferência, nome e observações explícitos de linha de Equipamento ou Componente a cadastro existente do mesmo Cliente. O código público e demais campos não são alterados. A comparação do retrato inclui observações e ocorre com bloqueio da linha, e a transação registra antes/depois e identificador idempotente. Ausência de observações preserva o valor anterior; informação explícita vazia não apaga dados.

O comando exige o gate de incorporação e não concede execução. A exigência de aprovação do lote permanece no gatilho de incorporação. Não aciona Auvo diretamente.

## Limites

Sistemas não possuem campo canônico de observações equivalente e os cadastros de Sistemas, Equipamentos e Componentes não possuem campo estruturado de características equivalente ao de Grupos Quantitativos. Não se converte observação em descrição nem se cria segunda fonte oficial implicitamente. Esses campos permanecem pendentes de desenho integrado; a atualização de nome de Sistema existente continua pelo comando anterior. Revisar efeitos de triggers legados e concorrência, testar e homologar antes de ativar.
