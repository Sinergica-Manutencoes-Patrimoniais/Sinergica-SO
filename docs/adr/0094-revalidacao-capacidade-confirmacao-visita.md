---
name: "docs-adr-0094-revalidacao-capacidade-confirmacao-visita-md"
description: "Documento Sinérgica SO: ADR-0094 — Revalidação de capacidade na confirmação da Visita"
alwaysApply: false
---

# ADR-0094 — Revalidação de capacidade na confirmação da Visita

## Estado

Proposta para teste local; não libera homologação, deploy ou operação Auvo.

## Contexto

O comando de confirmação já verifica `visita.confirmar` depois de obter o bloqueio da Visita. Entretanto, ainda aguarda bloqueios do responsável e das OS depois dessa verificação. Um teste com duas sessões demonstrou que a concessão pode ser revogada e confirmada durante essa espera, e a confirmação ainda assim prosseguir.

## Decisão

Conservar o contrato, idempotência e regras existentes. No trigger de validação da transição para `confirmada`, após obter os bloqueios das OS e verificar sua elegibilidade, reavaliar `visita.confirmar` para o Cliente da própria Visita. Quando indisponível, recusar com erro uniforme antes de concluir a atualização. O trigger também alcança alterações diretas da transição, sem presumir que permissão de escrita genérica concede capacidade crítica. Não alterar outras transições ou contratos legados.

Essa proteção fecha a corrida demonstrada quando a revogação é confirmada durante as esperas anteriores. Ela **não** serializa uma revogação iniciada após a última checagem e antes do commit. Também não assegura serialização simultânea das alterações de grupos, módulos, perfis, usuário e Cliente. Esses cenários continuam bloqueios para homologação e exigem desenho de travas comum às operações de permissão, avaliação de deadlock e testes em duas sessões, sem depender de claims antigos.

No banco isolado, os dois cenários de espera falharam antes da correção e passaram com a função substituta carregada somente na transação que executou a confirmação. O caso inverso demonstra a lacuna: a revogação não aguarda a transação de confirmação; o teste permanece explicitamente `TODO`. Os demais cenários do roteiro multi-sessão executam a função anterior após rollback e não comprovam a migration. A suíte pgTAP de Visitas passou 217 verificações com 0316 na mesma transação, revertida ao final; não substitui CI ou teste multi-sessão integral da função nova.

## Validação e rollout

Executar testes em duas sessões para revogação durante espera do funcionário e da OS, confirmação permitida, Cliente distinto, permissão revogada e rollback sem evento ou envio Auvo. Testes sintéticos em banco isolado não comprovam autorização de todas as ações críticas existentes. Migration aditiva preserva função e trigger, sem reescrever migration anterior; aplicar em ambiente real somente após inventário de consumidores e concessões, revisão adversarial e rollout autorizado. Caso concessões atuais não estejam provisionadas, o novo comportamento nega a ação; conferir antes de publicar e planejar rollback seguro sem apagar auditoria.
