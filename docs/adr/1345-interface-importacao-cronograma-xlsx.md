---
name: "docs-adr-1345-interface-importacao-cronograma-xlsx-md"
description: "Documento Sinérgica SO: ADR-1345 — Interface controlada da recepção XLSX de cronograma"
alwaysApply: false
---

# ADR-1345 — Interface controlada da recepção XLSX de cronograma

**Estado:** proposta; não implantada nem homologada.

## Contexto

A prévia e a recepção atestada de cronogramas estão conectadas somente em builds de desenvolvimento. O PCM precisa poder receber a planilha para conferência depois que o transporte e o servidor forem validados, sem aprovar automaticamente o Plano.

## Decisão

Preparar flag de interface independente, desligada por padrão, para permitir envio e reconciliação também em builds operacionais. A flag de desenvolvimento continua restrita a DEV. A prévia permanece obrigatória, o arquivo original é preservado para a mesma tentativa e a recepção continua sujeita à autenticação, assinatura e aos gates do servidor. A interface não habilita a função Edge nem altera o estado do Plano.

## Limites

Antes de habilitar, validar worker e limites no runtime real, origem/assinatura, concorrência, revogação, recuperação, RLS/FORCE, configuração e rotação do segredo e revisão adversarial. Configuração da função pode afetar deploy automático: qualquer implantação e abertura de gates pertence a DevOps ou humano, em etapa posterior. Não há envio ou implantação nesta alteração.
