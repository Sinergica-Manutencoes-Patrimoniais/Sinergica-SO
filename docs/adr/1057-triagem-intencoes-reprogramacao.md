---
name: "docs-adr-1057-triagem-intencoes-reprogramacao-md"
description: "Documento Sinérgica SO: ADR-1057 — Triagem de intenções de reprogramação"
alwaysApply: false
---

# ADR-1057 — Triagem de intenções de reprogramação

**Status:** preparação não homologada. Complementa ADR-0209 e E01-S185.

A reconciliação lista intenções pendentes de reprogramação, com identificação mínima da OS, Visitas e tarefa Auvo declarada. Exige simultaneamente capacidades de reconciliação e confirmação de Visita para o Cliente, gates existentes e gate próprio fechado. Motivo, payload, custos e dados de outros Clientes não são retornados. A intenção é exclusivamente local: nem seu estado nem o ID cadastrado provam reprogramação remota.

Leitura usa Cliente atual da OS e confere Cliente das Visitas. Não executa rede, retry ou decisão; itens incompatíveis ficam fora da consulta e exigem diagnóstico separado. A concessão autenticada depende de gates fechados. Validar isolamento, revogação concorrente, mudanças nas fontes, paginação, política de custos, acesso ao contexto e revisão adversarial antes de ativar.
