---
name: "docs-adr-0031-integridade-hierarquia-componentes-md"
description: "Documento Sinérgica SO: ADR-0031 — Integridade concorrente da hierarquia de Componentes"
alwaysApply: false
---

# ADR-0031 — Integridade concorrente da hierarquia de Componentes

**Status:** Decisão para implementação local da E01-S176. **Data:** 2026-10-26.

## Contexto e decisão

`pcm.equipamentos.parent_item_id` já existe e preserva os cadastros e códigos. A validação atual de mesmo Cliente ocorre na aplicação e não protege atualizações diretas ou ciclos concorrentes. A posição física (`area_id`/`local_id`) e a composição funcional são relações distintas.

Um trigger aditivo verificará novas alterações de pai e Cliente no servidor, usando o cadastro existente: pai ativo e não excluído, mesmo Cliente, sem autoparente nem ciclo, e sem deixar filhos existentes em outro Cliente. Alterações serão serializadas por Cliente com bloqueios transacionais em ordem determinística; erros rejeitam toda a alteração. A validação alcança chamadas diretas e adaptadores existentes, sem gerar tarefa Auvo nova.

## Compatibilidade

O trigger não reescreve nem remove legado. Registros sem pai e sem Cliente continuam aceitos, inclusive inbound Auvo; alteração que não muda pai nem Cliente não reconcilia um problema histórico. Antes de rollout, inventariar ciclos, pais ausentes/inativos e divergências existentes e tratar resultados por lote aprovado, sem inferir identidade. Comando idempotente, histórico de movimento, Grupo Quantitativo e interface são entregas subsequentes da E01-S176; o trigger isolado não constitui PASS.

Migrations seguem sequência aditiva, sem modificar migrações aplicadas. Testes positivos/negativos, mudanças de Cliente, dois Clientes e concorrência real são necessários; revisão adversarial e integração com autorização E01-S170 antecedem homologação.

A `0254` renomeia o trigger para `trg_equipamentos_zz_hierarquia_s176`, garantindo execução após a normalização da posição; a instrução de reverso anotada em `0247` é histórica e não basta depois dessa migration. Ver ADR-0035.
