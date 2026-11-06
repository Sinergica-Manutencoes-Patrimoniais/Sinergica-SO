---
name: "docs-adr-0182-atualizacao-nome-levantamento-md"
description: "Documento Sinérgica SO: ADR-0182 — Atualização restrita de nome por levantamento"
alwaysApply: false
---

# ADR-0182 — Atualização restrita de nome por levantamento

## Contexto

O fluxo de vínculo a cadastro existente não atualiza dados. Atualizações parciais sem comparar o estado corrente podem sobrescrever uma edição concorrente e os escritores legados ainda podem sincronizar com Auvo.

## Decisão

Preparar comando privado que, na aprovação de linha de Sistema, Equipamento, Componente ou Grupo, compara snapshot explícito do cadastro sob lock, atualiza somente o nome, mantém identidade/código/local/classificação e registra decisão e auditoria antes/depois no mesmo commit. Rejeita referência de pai não resolvida, código da fonte divergente, linha decidida e escopo diferente. Consulta intermediada permite conferir snapshot. Gate de escrita desligado e funções revogadas.

## Limites

Não atualiza quantidade, características, localização, classificação nem outros atributos; linhas que os contenham são recusadas para não descartá-los. Snapshot cobre os campos cujo valor determina o comando, não é revisão global universal para todos os escritores. Triggers legados podem enfileirar Auvo e a tabela de decisão não diferencia formalmente atualização de criação; não ativar sem reconciliação, UI explícita e testes de concorrência/segurança. Grupo com código informado permanece bloqueado.
