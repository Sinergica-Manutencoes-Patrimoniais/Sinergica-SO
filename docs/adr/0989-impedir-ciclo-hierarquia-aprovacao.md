---
name: "docs-adr-0989-impedir-ciclo-hierarquia-aprovacao-md"
description: "Documento Sinérgica SO: ADR-0989 — Recusa de ciclo na aprovação parcial"
alwaysApply: false
---

# ADR-0989 — Recusa de ciclo na aprovação parcial

Status: preparação privada, não homologada.

Uma seleção de linhas em que cada pai também está selecionado pode passar na conferência local de dependências mesmo se formar ciclo. Preparar verificação recursiva da cadeia de pais para cada linha selecionada, sob a trava do lote, antes de nova aprovação parcial. Ciclo e profundidade acima de 1.000 são recusados; referências ausentes e demais regras permanecem no comando existente. Não classificar referências externas como erro apenas por não constarem no lote.

Retentativa de request já registrado continua delegada ao recibo existente, sem submeter uma operação confirmada às condições atuais. A proteção é invocada pela entrada 1141, que depende da 1142; não habilitar antes da aplicação sequencial e validação. A leitura percorre somente vínculos representados por `referenciaPai`; não substitui regras de tipo, hierarquia oficial, duplicidade, aprovação PCM ou revisão de outras entradas de aprovação. Testar limites, profundidade, ciclos, concorrência, isolamento, plano de execução e revisão adversarial antes de ativar.
