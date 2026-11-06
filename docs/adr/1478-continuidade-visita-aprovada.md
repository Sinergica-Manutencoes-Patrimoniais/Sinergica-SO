---
name: "docs-adr-1478-continuidade-visita-aprovada-md"
description: "Documento Sinérgica SO: ADR-1478 — Continuidade de ocorrência por Visita após revisão"
alwaysApply: false
---

# ADR-1478 — Continuidade de ocorrência por Visita após revisão

## Contexto
O gerador de Visita reutiliza ocorrência por Rotina, alvo, série e semana. Sem vínculo com a decisão da revisão, uma versão nova pode reutilizar silenciosamente conteúdo anterior sem evidência de que o PCM optou por mantê-lo.

## Decisão
Ao preparar a aprovação de revisão, avaliar também decisões e fontes observadas de Visita e selar na mesma transação cada decisão de manter. Quando o protocolo de continuidade estiver habilitado, reutilização entre versões exige o selo da versão aprovada, mesma Visita, série, semana, Rotina lógica e alvo. O vencimento e a ocorrência já existentes permanecem históricos; a mudança não cancela OS nem cria trabalho externo. Reutilização na mesma versão mantém o comportamento atual. Com o gate desligado, comportamento atual é preservado.

## Limites
A avaliação continua parcial: fontes legadas sem relação demonstrada, PMOC e escritores não inventariados impedem liberar a guarda independente de aprovação. Testar concorrência, replay, feriados, mudança de dia/semana, vinculação entre versões e uso pelos consumidores, além de revisão adversarial antes de ativar. Nada é enviado ao Auvo.
