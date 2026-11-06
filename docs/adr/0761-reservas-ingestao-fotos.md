---
name: "docs-adr-0761-reservas-ingestao-fotos-md"
description: "Documento Sinérgica SO: ADR 0761 — Reserva e confirmação internas de ingestão de fotos"
alwaysApply: false
---

# ADR 0761 — Reserva e confirmação internas de ingestão de fotos

## Decisão

Preparar persistência separada e auditada para intenção de foto por requestId, ator, Cliente, lote, linha e digest SHA-256 calculado pelo servidor. A reserva gera caminho único no banco e mantém o digest e a identidade originais; repetição idêntica devolve o mesmo estado, dados divergentes conflitam. A confirmação verifica permissão atual, gate, reserva, lote/linha e identidade do objeto privado no caminho reservado; grava foto e confirmação na mesma transação. Os dados e funções são revogados inclusive de `authenticated` e `service_role`, sem endpoint novo ou concessão operacional.

O comando interno de confirmação pressupõe que um mediador confiável tenha lido os bytes do objeto e calculado o digest; o banco, sozinho, **não comprova esse cálculo nem a estabilidade dos bytes**. Não conceder execução enquanto não houver mediação autenticada que ligue a prova ao comando, nem afirmar que um identificador ou caminho seja versão imutável. Cada leitura do novo fluxo terá de comparar os bytes efetivamente recebidos ao digest protegido e revalidar autorização. O fluxo anterior e os arquivos legados não são alterados e não adquirem prova retroativa.

## Limites e verificação

O gate inicia desligado. A reserva pode ficar pendente e o Storage pode conter órfãos se a operação for interrompida; não apagar ou reconfirmar automaticamente. Segurança de service role, verificação do conteúdo, corrida com alteração privilegiada, recuperação de pendências, isolamento e replay exigem testes reais em ambiente isolado e revisão adversarial antes da exposição. A migration não ativa interface nem integração Auvo.
