---
name: "docs-adr-0941-processamento-xlsx-incremental-experimental-md"
description: "Documento Sinérgica SO: ADR-0941 — Composição experimental do leitor incremental XLSX"
alwaysApply: false
---

# ADR-0941 — Composição experimental do leitor incremental XLSX

**Status:** preparação isolada, sem conexão operacional.

Preparar uma função separada que combina extração limitada, metadados existentes e leitores SAX experimentais de strings e aba. A saída tem a mesma estrutura lógica do processador anterior, incluindo evidências de fórmulas e hash dos bytes originais. A função não recebe rede nem grava dados e não substitui o processador atual.

Os metadados ainda usam DOM e os arrays de células e strings continuam materializados. A função não garante memória, CPU, cancelamento preemptivo nem concorrência. Antes de integrar ao endpoint: equivalência com leitor atual, fontes originais, XML/ZIP adversarial, limites do runtime, autenticação, revogação, isolamento e revisão de segurança. Manter gates fechados e respeitar ADR-0919.
