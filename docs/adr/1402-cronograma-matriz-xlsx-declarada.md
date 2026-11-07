---
name: "docs-adr-1402-cronograma-matriz-xlsx-declarada-md"
description: "Documento Sinérgica SO: ADR-1402 — Valores locais de XLSX na conferência manual de cronograma"
alwaysApply: false
---

# ADR-1402 — Valores locais de XLSX na conferência manual de cronograma

Em alternativa à recepção atestada, o usuário pode transferir explicitamente os valores extraídos localmente para a matriz manual já existente. Fórmulas e células de erro bloqueiam a transferência; depois o operador precisa conferir e enviar o lote pelo fluxo manual autorizado. A ação não cria Plano, ocorrência ou tarefa.

O arquivo original não é enviado nem autenticado; a matriz é declarada e não verificada. Flag desativada por padrão. Antes de habilitar, validar parser e datas, limites, ausência de omissões, autorização, sessão, replay, revisão e auditoria. A via não substitui o recebimento atestado.
