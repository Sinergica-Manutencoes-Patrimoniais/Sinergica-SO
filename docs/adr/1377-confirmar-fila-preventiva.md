---
name: "docs-adr-1377-confirmar-fila-preventiva-md"
description: "Documento Sinérgica SO: ADR-1377 — Confirmação de entrada preventiva em verificação"
alwaysApply: false
---

# ADR-1377 — Confirmação de entrada preventiva em verificação

**Estado:** proposta; não aplicada nem homologada.

## Decisão

Permitir ao PCM confirmar uma entrada da fila em `verificacao` como `aguardando` quando a fonte preventiva vinculada for revalidada como candidata aguardando. A operação exige gate próprio fechado por padrão, capacidade de gestão, revisão esperada, motivo, identidade canônica e request idempotente; reusa as travas das fontes e o histórico de comandos da fila. Cancela-se somente com o comando existente. Não cria OS, tarefa Auvo ou conclusão de execução.

## Limites

A classificação só cobre a fonte reconhecida pelo verificador legado; não prova ausência de efeitos externos ou completude da fila. Validar todas as fontes, permissões, Cliente, revisão, concorrência, replay, locks, RLS/FORCE e revisão adversarial antes de habilitar.
