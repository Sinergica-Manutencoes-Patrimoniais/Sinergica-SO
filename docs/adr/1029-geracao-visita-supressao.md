---
name: "docs-adr-1029-geracao-visita-supressao-md"
description: "Documento Sinérgica SO: ADR-1029 — Geração contratual com supressão registrada"
alwaysApply: false
---

# ADR-1029 — Geração contratual com supressão registrada

Status: preparação privada, não homologada.

Preparar mediador da geração existente que confere ator e Cliente, toma as travas de feriados e série/semana, e recusa nova geração quando já houver supressão manual ativa. Repetição de pedido já registrado continua delegada ao comando proprietário. O caminho antigo fica privado após rollout e o novo nasce sem concessão, com gate fechado; adapter só o seleciona por flag desligada.

O gerador já registra sua própria decisão quando encontra feriado; não criar uma segunda supressão manual automaticamente. A ausência de declarações não prova cobertura oficial, e Visitas legadas sem origem, outras entradas e mudança de regra exigem reconciliação. Validar ordem de locks existente, preservação de visitas, replay, RLS/FORCE, permissões, fontes e revisão adversarial antes de habilitar. Nenhuma geração ou tarefa real é autorizada.
