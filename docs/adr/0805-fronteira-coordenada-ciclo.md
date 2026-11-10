---
name: "docs-adr-0805-fronteira-coordenada-ciclo-md"
description: "Documento Sinérgica SO: ADR-0805 — Fronteira coordenada para ciclo de calendário"
alwaysApply: false
---

# ADR-0805 — Fronteira coordenada para ciclo de calendário

## Estado

Preparação local E01-S166. Gate desligado, sem EXECUTE para perfis de aplicação; não autoriza geração, vencidos, implantação ou efeitos externos.

## Decisão

Instrumentar as quatro funções existentes de materialização individual e em lote, canônica e legada, sem renomear suas identidades ou alterar ACLs. Com protocolo de impacto 0787 ativo, exigem `READ COMMITTED`, sessão e concessão atual `plano.gerir` no Cliente, e tentam obter a mesma chave transacional global de 0787 **antes** dos locks de linha. Autorização é revalidada após obter a chave. Com gate desligado, o comportamento anterior é preservado. Conteúdo, revisão, identidade canônica, requestId, resultado e auditoria continuam sob responsabilidade das funções existentes. A proteção não reduz suas validações nem habilita vencidos.

## Limitações e gates

A chave global coordena apenas participantes do protocolo 0787; não prova cobertura de leitores e escritores de Plano, PMOC, chamadas legadas ou todas as fronteiras externas. Chamadas a funções internas e geradores legados podem não adquiri-la no início. Não habilitar gate até inventariar e adaptar todos os participantes, demonstrar identidade entre origens sem inferência por data, e testar disputas nas duas ordens, revogação durante espera, autorização/ACL, rollback, gate e reconciliação. A substituição textual da definição existente deve falhar se os marcadores esperados não forem únicos; qualquer drift exige revisão, nunca aplicação parcial. A ativação futura exige coordenação para impedir troca concorrente do gate. Guardas não substituem CI e revisão adversarial.

Sem backfill, mudança de agenda, OS ou Auvo. Em reversão, manter gate desligado e restaurar as definições anteriores sob revisão; não remover dados ou histórico.
