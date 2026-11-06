---
name: "docs-adr-1481-conferencia-fuso-revisao-md"
description: "Documento Sinérgica SO: ADR-1481 — Conferência de fuso das séries na revisão"
alwaysApply: false
---

# ADR-1481 — Conferência de fuso das séries na revisão

## Contexto
A revisão registra fuso declarado, mas sua referência contratual não comprova automaticamente vínculo do Plano. As Rotinas por Visita possuem vínculos explícitos a séries contratuais, cada uma com regra de fuso e vigência.

## Decisão
Comparar declaração mais recente e contrato de referência com as séries vinculadas às Rotinas por Visita do rascunho e as regras vigentes na data proposta. Informar separadamente Rotinas sem série, série sem regra, contratos e fusos divergentes. Ausência de Visitas, vínculo ou regra não é prova positiva. Não alterar snapshots nem a guarda independente de aprovação; comparação entre cadastros não demonstra que o documento contratual externo foi validado.

## Limites
Vínculos de série não são versionados, logo não comprovam histórico. Fontes de fuso para Rotinas por calendário sem Visita exigem verificação própria. Testar concorrência, privacidade, séries múltiplas e fronteiras de vigência antes de habilitar. Não aciona Auvo.
