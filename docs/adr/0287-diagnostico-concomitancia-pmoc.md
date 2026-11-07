---
name: "docs-adr-0287-diagnostico-concomitancia-pmoc-md"
description: "Documento Sinérgica SO: ADR-0287 — Diagnóstico conservador de concomitância PMOC"
alwaysApply: false
---

# ADR-0287 — Diagnóstico conservador de concomitância PMOC

Status: proposta, não homologada.

O PMOC legado registra agendamento por imóvel e contrato; a fonte não comprova correspondência inequívoca com o alvo de uma Rotina do Plano. A consulta compara datas previstas de uma Rotina por calendário aprovada com contagem de agendamentos PMOC não cancelados de imóveis e contratos válidos do mesmo Cliente. Uma coincidência é apenas indício para conferência, não prova de duplicidade ou equivalência de alvo; ausência também não prova ausência de conflito. Não expõe IDs de outros Clientes nem altera dados ou geradores.

Paginação usa índice de ciclo da prévia, fonte limitada ao período consultado. Gate próprio nasce fechado e EXECUTE revogado; são necessárias revisão de privacidade, vínculo funcional e testes antes de ativação. Não desliga, gera ou cancela qualquer OS.
