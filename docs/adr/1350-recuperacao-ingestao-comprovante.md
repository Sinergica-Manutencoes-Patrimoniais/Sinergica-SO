---
name: "docs-adr-1350-recuperacao-ingestao-comprovante-md"
description: "Documento Sinérgica SO: ADR 1350 — Recuperar confirmação de ingestão do comprovante"
alwaysApply: false
---

# ADR 1350 — Recuperar confirmação de ingestão do comprovante

## Contexto

Após perda da resposta do upload mediado, a correção mantém request e digest locais, mas exige novamente o arquivo mesmo quando a ingestão já foi confirmada.

## Decisão

Disponibilizar leitura autenticada pelo request, Cliente, Visita, despesa e digest exatos. Ela devolve apenas a identidade do objeto confirmado para o mesmo ator e objeto privado ainda presente, sem expor caminho nem bytes. Reserva ausente, pendente ou divergente retorna resultado não confirmado; isso não prova falha. A recuperação usa os gates existentes e a trava do request, não executa a correção financeira e não substitui a verificação do arquivo na leitura posterior.

## Consequências

Requer autorização atual, isolamento de Cliente, RLS/FORCE, validação de locks, replay, revogação e Storage real, além de revisão adversarial. A interface somente atualiza a tentativa local após conferir resposta e sessão; confirmação da correção continua separada. Não altera policies compartilhadas.
