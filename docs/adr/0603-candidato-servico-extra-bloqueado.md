---
name: "docs-adr-0603-candidato-servico-extra-bloqueado-md"
description: "Documento Sinérgica SO: ADR-0603 — Candidato de serviço extra bloqueado por identidade"
alwaysApply: false
---

# ADR-0603 — Candidato de serviço extra bloqueado por identidade

Status: pendente de implementação e validação.

A declaração e decisão internas (0816), o snapshot da linha pública (0821) e a coordenação de quantidade (0824) não demonstram, por si, a identidade única de um serviço efetivamente executado. A chave informada na declaração é humana; tampouco há prova de que o mesmo fato não foi faturado por outra origem. Limitar a soma das quantidades não resolve essa duplicidade semântica. A linha pública também não comprova sua classificação como serviço.

Decisão: não criar candidato faturável nem liberar comando de reconhecimento enquanto não houver fonte canônica de execução, identificação estável e exclusiva entre origens, classificação confiável da linha e protocolo transacional revisado. Uma decisão humana de aceite interno não substitui essas garantias. Não efetuar cobrança ou lançamento financeiro.

Antes de desenvolver a efetivação, identificar as fontes existentes e a política aplicável, coordenar todos os escritores e a escolha entre faturamento integral e por linha, garantir competência aberta, idempotência e saldo, e validar concorrência, permissões e migrações em ambiente apropriado. A migration 0828 é intencionalmente sem efeito e não constitui implementação nem homologação.
