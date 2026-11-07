---
name: "docs-adr-0661-aplicacao-parcial-campos-md"
description: "Documento Sinérgica SO: ADR-0661 — Aplicação oficial de campos com aprovação parcial"
alwaysApply: false
---

# ADR-0661 — Aplicação oficial de campos com aprovação parcial

Status: proposta; gates fechados, não homologada.

Os comandos existentes de Sistema, Componente e localização continuam exigindo conferência do retrato atual, autorização, revisão do lote, dependências, snapshot oficial e proteções de sincronização. Quando não existe aprovação integral válida no ciclo, podem reconhecer somente a aprovação parcial vigente daquela linha, desde que ela congele os mesmos atributos, revisão do código e campos estruturados. A guarda comum de incorporação 0883 continua obrigatória.

As migrations 0756, 0767 e 0845 ainda não aplicadas passam a depender da função privada 0886; os gates respectivos devem permanecer desligados até todas as migrations serem instaladas. Não habilitar antes de testes de concorrência, isolamento, reconferência, rollback e efeitos externos e revisão adversarial. Reversão operacional e reservas de código continuam fora desta mudança.
