---
name: "docs-adr-0032-grupo-quantitativo-no-pcm-md"
description: "Documento Sinérgica SO: ADR-0032 — Grupo Quantitativo em Local existente"
alwaysApply: false
---

# ADR-0032 — Grupo Quantitativo em Local existente

**Status:** Decisão para implementação local da E01-S176. **Data:** 2026-10-26.

Um Grupo Quantitativo representa unidades homogêneas em um Local existente, com quantidade inteira positiva, categoria do catálogo e características. É um agregado PCM próprio, sem criar uma linha de `pcm.equipamentos`, TAG individual ou Equipment Auvo por unidade. Seu Cliente deriva da Área do Local; eventual Sistema deve ser do mesmo Cliente. Um Sistema opcional por grupo preserva a regra de vínculo funcional único. Nome, quantidade, Local e atributos mudam com revisão e trilha auditável, preservando identidade.

A escrita passa por comando transacional com `requestId`, revisão esperada e autorização atual por Cliente. Para não confundir edição de estrutura com aprovação de levantamentos, o catálogo E01-S170 ganha as ações técnicas distintas `cadastro.ler` e `cadastro.gerir`; nenhuma concessão é inferida de módulo ou atribuída automaticamente. Leitura aceita uma das duas capacidades; escrita exige `cadastro.gerir` e módulo PCM de escrita. Não se cria mecanismo paralelo de identidade ou de sincronização externa.

A tabela é nova, com RLS FORCE e escrita direta negada. O registro de comandos da estrutura pertence a PCM e garante idempotência por ator/payload; auditoria guarda antes/depois e correlação na mesma transação. Não se altera `pcm.equipamentos` nem a árvore física para guardar o grupo. Fotos, 360 completo, importação e codificação pública permanecem nas respectivas fatias; esta fundação não declara story concluída.
