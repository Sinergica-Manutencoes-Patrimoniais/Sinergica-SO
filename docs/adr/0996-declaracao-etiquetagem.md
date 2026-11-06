---
name: "docs-adr-0996-declaracao-etiquetagem-md"
description: "Documento Sinérgica SO: ADR-0996 — Declaração de etiquetagem"
alwaysApply: false
---

# ADR-0996 — Declaração de etiquetagem

Status: preparação privada, não homologada.

Como não foi identificada emissão rastreável de etiquetas no SSO, preparar comando explícito de declaração de etiqueta já aplicada, não uma inferência a partir de prévia, geração de QR ou impressão. O comando exige ator e Cliente esperados, capacidade de gestão cadastral, código atual conferido e requestId. Sob as travas de autorização, gate e namespace de códigos, inicializa o ciclo se necessário, preserva o primeiro marco e registra auditoria e recibo idempotente na mesma transação. Não produz etiqueta nem altera código.

O comando não comprova fisicamente a aplicação; a auditoria registra uma declaração do operador. Não habilitar antes de validar permissões, FORCE RLS, ordem de locks, concorrência com troca de código, efeitos dos triggers, recuperação de resposta, política de auditoria e revisão adversarial. Interface de declaração e integração com eventual emissor real ainda precisam ser desenvolvidas; gate e execução permanecem fechados.
