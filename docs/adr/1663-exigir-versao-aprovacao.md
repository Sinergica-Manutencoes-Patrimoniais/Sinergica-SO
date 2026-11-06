---
name: adr-1663-exigir-versao-aprovacao
description: Protege aprovações novas com token privado e gate de rollout.
alwaysApply: false
---

# ADR-1663 — Exigir versão conferida em novas aprovações

## Contexto

A borda 1804 confere a versão escolhida, mas os comandos anteriores continuam acessíveis e aceitam novas aprovações sem informar a versão. Os recibos antigos devem continuar recuperáveis.

## Decisão

Uma proteção aditiva, desabilitada por padrão, exige token privado da transação para aprovações novas. A borda 1804 emite o token após validar ator, Cliente, Plano, revisão, vigência e versão e o remove após a chamada. O núcleo de aprovação exige correspondência exata com a versão efetivamente selecionada antes dos efeitos. O token não usa variáveis de sessão controláveis pelo chamador; tabelas e helper não têm acesso público.

A guarda no núcleo vem depois do retorno de replay já autorizado e validado, preservando recibos existentes. O caminho mediado de revisão continua sujeito aos seus próprios gates e validações; a guarda de vigência e o protocolo de impactos permanecem aplicáveis. Os locks existentes de autorização, request, Plano e versão são mantidos; a guarda lê o gate com SHARE NOWAIT e exige READ COMMITTED quando habilitada.

## Implantação e limites

O gate nasce desligado. Sua ativação bloqueia novas aprovações por clientes antigos, mas não torna outros gates disponíveis. Exige rollout coordenado, clientes preparados, ensaio dos dois modos e replays antigos e novos, negações, rollback e concorrência, inclusive alteração do gate. Migrações antigas e recibos não são modificados. Sem esses ensaios, a implementação é candidata e não autoriza produção. A revogação de autorização continua prevalecendo sobre replay.
