---
name: "docs-adr-0081-politicas-preventivas-restritas-origem-md"
description: "Documento Sinérgica SO: ADR-0081 — Políticas preventivas legadas limitadas à origem"
alwaysApply: false
---

# ADR-0081 — Políticas preventivas legadas limitadas à origem

## Decisão

As políticas de leitura legadas de Ocorrências, avaliações e achados continuam permitindo os mesmos papéis para dados legados, mas somente quando a Ocorrência associada tem `origem = legado`. Avaliação verifica a Ocorrência; achado verifica avaliação e Ocorrência. Isso aplica inclusive ao atalho legado de superadmin: o acesso à futura origem nova precisa de política e capacidade próprias por Cliente, não de ampliação acidental de política permissiva existente.

Esta fase não cria política para origem nova, não permite gravá-la e não restringe diretamente service role, que ignora RLS. Edge Functions privilegiadas ainda precisam separar origens e revalidar acesso. O filtro não resolve o escopo por Cliente dos dados antigos, preservado nesta fase para compatibilidade. Testes simulam origem nova apenas dentro de transação revertida, incluindo descendentes, leitor PCM e superadmin.

## Implantação e reversão

Exige migration 0304 primeiro. Mudança de políticas precisa ser atômica e testada com dados representativos, permissões efetivas e desempenho dos joins; conferir todas as políticas aplicáveis no ambiente alvo, pois políticas permissivas adicionais podem ampliar acesso. Para recuo, restaurar políticas anteriores apenas enquanto a constraint impede qualquer origem nova. Não liberar novo escritor até testes reais de isolamento por Cliente, funções privilegiadas e revisão adversarial.
