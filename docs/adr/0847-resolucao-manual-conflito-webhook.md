---
name: "docs-adr-0847-resolucao-manual-conflito-webhook-md"
description: "Documento Sinérgica SO: ADR-0847 — Resolução manual de conflito do webhook"
alwaysApply: false
---

# ADR-0847 — Resolução manual de conflito do webhook

Estado: proposta local, não homologada; gate fechado. Complementa ADR-0842 e ADR-0846.

O PCM precisa registrar decisão sobre conflito de estado, mas os dados atuais não comprovam identidade ou retry do evento Auvo. Resolução será apenas ação explícita autorizada por `integracao.reconciliar`, com atestado de que o operador conferiu o estado remoto. O atestado é declaração humana, não prova automatizada de que houve consulta ao Auvo. A transação não consulta nem altera o serviço externo.

O comando exige Cliente, conflito, requestId, fotografia de `updated_at`, task e status da OS. Sob lock de autorização, da ocorrência e da OS, valida que a task e a fotografia não mudaram e que o status local é igual ao status remoto registrado no conflito. Rejeita ausência de confirmação ou divergência. Grava decisão e auditoria na mesma transação; retry idêntico, pelo mesmo ator ainda autorizado, retorna a mesma decisão; requestId com payload diferente falha. Alteração concorrente após a decisão não é coberta pela fotografia e requer nova avaliação operacional.

Novas entregas para OS/task/status após resolução criam novo conflito, pois não é seguro tratá-las como a mesma entrega sem ID confiável. Isso pode reapresentar retry antigo; não é prova de novo evento. Nenhum dado original, decisão, histórico ou auditoria é apagado. O gate próprio inicia fechado, núcleo e tabelas sem acesso direto; o wrapper autenticado é apenas preparado. Testes de duas sessões, verificação do contrato Auvo, usabilidade, CI e revisão adversarial são obrigatórios antes de liberação. Rollback operacional: fechar o gate, mantendo decisões e conflitos.
