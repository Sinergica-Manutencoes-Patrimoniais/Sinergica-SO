---
name: "docs-adr-0770-reconciliacao-ingestao-foto-pendente-md"
description: "Documento Sinérgica SO: ADR 0770 — Reconciliação de ingestão de foto pendente"
alwaysApply: false
---

# ADR 0770 — Reconciliação de ingestão de foto pendente

## Decisão

Repetição com mesmo ator, request, lote, linha e digest nunca inicia outro upload. O serviço pode localizar somente o objeto privado no nome já reservado; ausência permanece pendente. Quando presente, relê os bytes, compara SHA-256 com os bytes reenviados e a reserva, revalida permissão e confirma pelo comando idempotente da 0968. Concorrência com upload ou outra confirmação não autoriza sobrescrita: objeto ausente ou ilegível fica pendente; confirmações concorrentes usam lock e replay existentes. Resultado incerto exige reenvio do mesmo arquivo pelo usuário e preserva request.

## Limites

Confirmar não prova imutabilidade no Storage: alteração privilegiada entre leitura e confirmação continua possível. Todas as leituras novas devem conferir digest, e nenhum caminho legado pode expor os bytes dessa trilha. A credencial service_role continua privilegiada; gate deve permanecer fechado até teste integrado, revisão adversarial, limites de taxa e tratamento operacional de órfãos. Não apagar objetos ou liberar nome automaticamente. Sem deploy e sem Auvo.
