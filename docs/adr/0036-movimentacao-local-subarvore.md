---
name: "docs-adr-0036-movimentacao-local-subarvore-md"
description: "Documento Sinérgica SO: ADR-0036 — Movimentação de Local e subárvore"
alwaysApply: false
---

# ADR-0036 — Movimentação de Local e subárvore

**Status:** decisão para implementação local E01-S176. **Data:** 2026-10-27.

Ao mudar a Área de um Local, a mesma transação atualiza seus Sublocais e a Área redundante dos Componentes e Sistemas instalados em cada Local, sem recriar registros nem alterar suas identidades. A validação existente exige o mesmo Cliente e não permite que um Sublocal se separe de seu pai. Cada movimentação de Componente produz auditoria pela ADR-0033; qualquer falha reverte toda a árvore. Triggers existentes de integração continuam válidos: é necessário avaliar e controlar seus efeitos antes de implantação, sem disparar tarefas reais nesta etapa.

Antes de publicar, avaliar volume, concorrência e dados legados inconsistentes/cíclicos, além de integrar as capacidades por ação aos cadastros antigos. Fluxos históricos não são reconstruídos, e nenhuma alteração se aplica retroativamente. A função é `security definer` para manter consistência dos dependentes; isso não amplia a autorização inicial para mover o Local e deve ser revisado adversarialmente antes de PASS.
