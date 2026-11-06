---
name: "docs-adr-0489-guarda-impacto-aprovacao-md"
description: "Documento Sinérgica SO: ADR-0489 — Bloqueio conservador de aprovação da revisão"
alwaysApply: false
---

# ADR-0489 — Bloqueio conservador de aprovação da revisão

Status: preparado, gate desligado, não aplicado nem homologado. A prévia autorizada informa versão anterior, rascunho, disponibilidade do snapshot e potenciais conflitos de vigência. Uma vigência anterior aberta é contada como potencial conflito antes de seu eventual fechamento; isso não prova conflito final.

Quando a proteção opt-in está habilitada, qualquer inserção do token 0342 é recusada: não existe ainda contrato completo e revisado para provar impactos, fuso e reconciliação. Com gate desligado a guarda não modifica legado; os gates de aprovação continuam desligados. Não gera ocorrência, altera vigência ou autoriza aprovação. Exige futura prova transacional, testes e revisão adversarial.
