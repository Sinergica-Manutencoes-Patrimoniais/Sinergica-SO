---
name: "docs-adr-0566-fonte-original-complemento-md"
description: "Documento Sinérgica SO: ADR-0566 — fonte original do complemento"
alwaysApply: false
---

# ADR-0566 — fonte original do complemento

Status: proposto; gates fechados, não aplicado nem homologado. Antes de conferir complemento de despesa, proposta integral ou linha, o servidor valida a fonte original do item base, sem alterar o valor original ou aprovado. Rejeita fontes não reconhecidas, versões divergentes, declarações não aceitas e valores não comprovados. Usa locks de fonte antes do item base e mantém a conferência de vínculo 0789; comandos concluídos seguem recuperação idempotente.

As regras são conservadoras e não constituem prova completa de integridade das fontes: todos os escritores, vínculos, modos de proposta, concorrência e fechamento precisam de revisão e testes adversariais. Nenhuma cobrança ou efeito externo é realizado.
