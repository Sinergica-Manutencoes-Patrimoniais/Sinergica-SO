---
name: "docs-adr-1533-grupo-fila-declaracao-pcm-md"
description: "Documento Sinérgica SO: ADR-1533 — Conferência PCM de Grupo Quantitativo na fila"
alwaysApply: false
---

# ADR-1533 — Conferência PCM de Grupo Quantitativo na fila

## Contexto
Grupos não possuem ponte para Plano Preventivo legado nem unidades individuais. Uma ocorrência de Grupo pode permanecer em verificação mesmo quando a identidade canônica está registrada, impedindo a confirmação da fila.

## Decisão
Permitir ao PCM registrar uma declaração auditada por ciclo, com fontes consultadas e motivo, após conferir fotografia dos vínculos locais conhecidos. A declaração exige a ocorrência única do Grupo, fila em verificação, identidade canônica, concessão atual e ausência de efeitos locais conflitantes na fotografia. Não cria unidades, ocorrência, OS nem tarefa Auvo. A operação não altera a fila automaticamente: a confirmação independente já existente continua necessária e revalida vigência e origem.

A declaração só é considerada atual enquanto a fotografia de efeitos for idêntica; novas OS, vínculos, Chamados ou alterações fotografadas tornam-na obsoleta. A decisão é humana e parcial: não comprova ausência de execução em fontes externas. Respostas e interface devem expressar essa limitação.

## Limites
Requer gates existentes de fila, identidade de Grupo e confirmação; não cria gate novo nem altera OS existentes. Concorrência de todas as fontes, permissões reais, fontes externas e revisão adversarial são obrigatórias antes de ativação/homologação. Qualquer efeito local incompatível deve permanecer em verificação.
