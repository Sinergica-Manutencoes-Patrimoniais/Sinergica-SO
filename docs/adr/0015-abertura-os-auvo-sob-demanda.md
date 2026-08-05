# ADR-0015 — Abertura de OS no Auvo passa de automática (trigger) para sob demanda

- **Status:** Aceito (Lucas aprovou o design em 2026-08-04; implementação em E01-S125, após auditar produtores de task Auvo)
- **Data:** 2026-08-04
- **Contexto de story:** E01-S125

## Contexto
A task no Auvo era criada automaticamente por um trigger de banco
(`pcm.fn_auvo_create_task_on_planejamento`) quando a OS entrava em `planejamento`. Isso criava OS no
campo sem revisão humana dos dados de abertura e sem chance de conferência prévia; erros só apareciam
depois, já no Auvo.

## Decisão
Remover/desativar o trigger e mover a criação para uma **ação explícita do operador**, sempre
precedida de um **dry-run** que exibe os campos que serão enviados. Dois gatilhos na UI: pergunta ao
mover pra Planejamento e botão "Abrir OS Auvo" no painel. Criação idempotente (grava `auvoTaskId`,
não duplica).

## Consequências
- **Positivas:** controle humano sobre o que vai pro Auvo; conferência antes; sem criação silenciosa;
  erros pegos antes de virar task.
- **Negativas/custos:** um passo manual a mais por OS; qualquer produtor que dependia do automático
  (Zé/WhatsApp/portal) precisa ser auditado e migrado (ver design, task 0).
- **Reversibilidade:** recriar o trigger restaura o comportamento automático — a mudança é reversível.

## Alternativas
- Manter trigger + confirmar na UI (impossível interceptar no banco).
- Flag de config auto on/off (mais superfície; pedido é desligar, não configurar).

## Relacionados
- Reverte comportamento introduzido no fluxo de sync Auvo (E01-S09/S22/S47).
- Interage com E01-S124 (mover Solicitação), E01-S120 (Auvo #id), E01-S123 (saúde Auvo).
