---
name: "docs-adr-1304-mediacao-transferencia-local-visita-md"
description: "Documento Sinérgica SO: ADR-1304 — Mediação da transferência local entre Visitas"
alwaysApply: false
---

# ADR-1304 — Mediação da transferência local entre Visitas

## Decisão

Preparar entrada autenticada para os dois comandos existentes de transferência,
atualmente privados. A entrada verifica ator e Cliente, usa trava de
autorização e gate próprio fechado, delega ao comando conforme a modalidade
persistida no request e reconfere Cliente antes de finalizar a transação.
Qualquer divergência reverte o comando delegado. A interface seleciona a
entrada nova por flag desligada e mantém a identidade da tentativa.

O comando não envia, cancela ou reprograma tarefa Auvo. A transferência de OS
já enviada continua sendo uma jornada distinta.

## Limites

Antes de ativar: conferir locks e gatilhos, autorização e revogação em duas
ordens, transferência de Cliente concorrente, replay, flags, RLS/FORCE,
permissões e revisão adversarial. A migration e cliente exigem implantação
coordenada e não abrem gates existentes.
