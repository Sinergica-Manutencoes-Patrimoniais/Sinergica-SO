---
name: spec-E01-S84-kanban-colunas-customizaveis
description: Contrato — Kanban de OS com colunas customizáveis (ordem e ocultar), incluindo coluna "Preventiva" ocultável puxando do plano de manutenção.
alwaysApply: true
tier: pequeno
---

# Spec — Kanban de OS: colunas customizáveis

> **Fonte da verdade.** Status: aprovado
> Origem: reunião Lucas × Fabrício (2026-07-16). "Você conseguir customizar as colunas também —
> inverter a ordem, ocultar. Tem uma preventiva entre corretiva e planejamento, ocultável, que puxa
> do plano de manutenção."

## Resumo
O Kanban de Ordens de Serviço passa a permitir **customizar as colunas**: reordenar e ocultar/exibir.
Inclui uma coluna "Preventiva" (ocultável) posicionável entre Corretiva e Planejamento, alimentada
pelo plano de manutenção (PMOC).

## Contexto atual (AS-IS)
- Kanban/Timeline/Calendário na `OrdensServicoPage.tsx` (E01-S38); drag-and-drop de card já existe
  (E01-S61). Colunas hoje são fixas por status.
- Plano de manutenção preventivo = PMOC (E01-S03…S08), cronograma de visitas.

## Critérios de aceite

### AC-1: Reordenar colunas
- **Dado** o Kanban de OS
- **Quando** o usuário reordena as colunas
- **Então** a nova ordem é aplicada e **persistida** (por usuário) — ao reabrir, mantém.

### AC-2: Ocultar/exibir colunas
- **Dado** o Kanban
- **Quando** o usuário oculta uma coluna
- **Então** ela some da visão (os cards daquele status continuam existindo, só não são mostrados
  naquela visão); pode ser reexibida. Preferência persistida por usuário.

### AC-3: Coluna "Preventiva" (ocultável) do plano de manutenção
- **Dado** contratos PMOC com cronograma
- **Quando** a coluna "Preventiva" está visível
- **Então** ela mostra as preventivas planejadas (origem cronograma PMOC), posicionável entre
  Corretiva e Planejamento; pode ser ocultada como qualquer outra.

### AC-4: Sem quebrar drag-and-drop existente
- **Dado** o drag-and-drop de card entre colunas (E01-S61)
- **Quando** as colunas são customizadas
- **Então** o move de card continua funcionando nas colunas visíveis.

## Fora de escopo (vinculante)
- Colunas customizadas por outra visão que não o Kanban de OS.
- Motor de alocação de "dias preventivos" por técnico (feature futura, já sinalizada em E01-S07).
- Compartilhar layout de colunas entre usuários (preferência é por usuário).

## Rastreabilidade
- `apps/web/src/features/pcm/pages/OrdensServicoPage.tsx` (views Kanban)
- Preferência de colunas: persistência por usuário (tabela `config`/`pcm` ou preferências de usuário)
- Origem preventiva: cronograma PMOC (`pmoc_*`, E01-S03/S07 `pmoc_schedule_id`)
