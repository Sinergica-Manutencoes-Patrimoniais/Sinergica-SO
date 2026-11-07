---
name: "docs-adr-0321-foto-privada-por-resposta-md"
description: "Documento Sinérgica SO: ADR-0321 — Foto privada associada a resposta"
alwaysApply: false
---

# ADR-0321 — Foto privada associada a resposta

Status: proposta, não homologada.

O PCM declara associação entre resposta e foto previamente referenciada no mesmo retorno. A transação confere Cliente, OS, nota, objeto e bucket privado novamente, registra justificativa e revisão monotônica do conjunto de associações; o histórico é imutável. Uma foto não é associada a qualquer pergunta automaticamente. Existência em Storage e metadado de tipo não comprovam autoria, conteúdo, pertinência ou execução; associação não valida cobertura nem encerra OS.

Gates de foto e validação e EXECUTE permanecem fechados. Ativação depende de testes e revisão adversarial, inclusive concorrência e revogação de acesso.
