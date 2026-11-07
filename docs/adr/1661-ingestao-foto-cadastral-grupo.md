---
name: "docs-adr-1661-ingestao-foto-cadastral-grupo-md"
description: "Documento Sinérgica SO: ADR-1661 — Ingestão verificável de foto cadastral de Grupo"
alwaysApply: false
---

# ADR-1661 — Ingestão verificável de foto cadastral de Grupo

## Estado

Proposta E01-S176; não aplicada nem homologada.

## Decisão

Reserva identifica imutavelmente ator, Cliente, Grupo, requestId e SHA-256 dos bytes recebidos. Uma Edge Function autentica a sessão e papel assinado, valida tamanho e assinatura da imagem, calcula digest e usa nome privado gerado pelo servidor com upload sem sobrescrita. Após upload ou recuperação de resultado incerto, baixa o objeto efetivo e compara digest antes da confirmação. Mediador exclusivo de serviço revalida sessão representada, papel atual, gate, capacidade e contexto, confirmando vínculo e reserva de forma idempotente. Não há transação única entre Storage e banco.

Toda leitura de foto criada por este fluxo compara o digest persistido com os bytes devolvidos; divergência bloqueia leitura e exige reconciliação. Fotos anteriores sem digest permanecem explicitamente não verificadas: nenhum digest é inventado. Objetos órfãos não são apagados automaticamente.

## Limites

Mesmo objeto e nome não provam imutabilidade no Storage. A garantia é sobre os bytes efetivamente verificados em cada leitura, não sobre atomicidade entre Storage e banco. Ativação exige revisão adversarial, testes de autenticação, Storage, revogação concorrente e recuperação após falha, além de gates fechados por padrão.
