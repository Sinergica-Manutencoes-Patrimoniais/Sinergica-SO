---
name: "docs-adr-0879-s171-transicao-visita-mediada-md"
description: "Documento Sinérgica SO: ADR-0879 — Mediação da transição local de Visita"
alwaysApply: false
---

# ADR-0879 — Mediação da transição local de Visita

Data: 2026-10-30 · Status: proposta, não implantada

## Contexto

A transição local preparada em 0409 preserva idempotência, revisão, histórico e recusa OS com efeito remoto identificado. O núcleo é privado e a interface não dispõe de uma entrada autenticada. A verificação isolada da permissão e do gate não prova segurança diante de revogação ou fechamento concorrentes.

## Decisão

Preparar uma entrada autenticada para a transição local, mantendo o núcleo privado e o gate existente fechado por padrão. A entrada exige READ COMMITTED, obtém trava compartilhada do protocolo de autorização e trava/reconfere o gate antes de chamar o núcleo na mesma transação. O núcleo continua responsável por estado, Cliente, revisão, requestId, efeitos remotos, histórico e auditoria. O cliente usa apenas a mediadora; nenhuma tarefa Auvo é enviada ou alterada.

Esta entrada não implementa a reprogramação de OS já enviada, composição de capacidade ou confirmação auditada de alertas. Não abrir o gate até que essas dependências, inventário de escritores e consumidores, isolamento/autorização, concorrência, CI e revisão adversarial sejam comprovados. Alterar frontend e banco exige rollout coordenado; o código antigo já chamava um núcleo privado, sem acesso autorizado.

O núcleo registra horários no payload JSON de idempotência. A entrada fixa UTC durante sua execução e preserva o fuso do chamador, evitando que duas sessões serializem o mesmo instante de formas diferentes. Pedidos históricos criados por acesso privilegiado ao núcleo sob outro fuso podem divergir: inventariar e resolver sem reescrever histórico antes do rollout.

## Consequências

Uma revogação que siga o protocolo compartilhado não confirma simultaneamente à transição. O protocolo não prova proteção contra escritores de autorização privilegiados que o ignorem nem cobre automaticamente estado de OS, vínculos e demais gates. O bloqueio permanece obrigatório até ensaios concorrentes e revisão completa. Não implica aceitação das stories S171/S172 ou mudança de política operacional.
