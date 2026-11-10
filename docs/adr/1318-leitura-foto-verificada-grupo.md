---
name: "docs-adr-1318-leitura-foto-verificada-grupo-md"
description: "Documento Sinérgica SO: ADR-1318 — Leitura da foto verificada vinculada ao Grupo"
alwaysApply: false
---

# ADR-1318 — Leitura da foto verificada vinculada ao Grupo

## Decisão

Preparar consulta por Grupo para usuário autorizado e resolução restrita ao
serviço para a leitura em bytes. A resolução verifica identidade ativa,
permissão atual, Grupo, vínculo, última decisão, retirada, inadequação,
reserva confirmada, objeto e digest. A Edge Function reutiliza o leitor de
foto verificada: confere SHA-256 dos bytes e reconsulta antes da entrega.
Nenhum caminho ou digest é exposto ao navegador.

Consulta, serviço e interface ficam sob gates/flags fechados. A leitura não
atesta execução ou origem Auvo; conferência não elimina a janela entre a
última autorização e a entrega.

## Antes de habilitar

Validar Auth/Storage/Edge reais, formato e limite, digest divergente,
revogação, troca de Cliente, decisões, concorrência, acesso de serviço,
RLS/FORCE, bytes/caminho e revisão adversarial.
