---
name: "docs-adr-0333-documento-publico-cobranca-md"
description: "Documento Sinérgica SO: ADR-0333 — Documento público associado à cobrança"
alwaysApply: false
---

# ADR-0333 — Documento público associado à cobrança

Status: proposta; gate fechado, sem testes.

O Financeiro vincula explicitamente uma cobrança já publicada a um anexo da mesma OS e Conta já aprovado e publicado para o Portal pelo fluxo PCM. Apenas o bucket de anexos públicos da OS é aceito; comprovantes privados de despesa nunca são fonte. A leitura lista exclusivamente vínculos de cobrança e anexo ainda válidos; o download reutiliza rota mediada da publicação da OS, que revalida revogação e autorização. Não cria cobrança, lançamento ou envio externo. Revisão de conteúdo, metadados, revogação concorrente e isolamento é obrigatória antes da ativação.
