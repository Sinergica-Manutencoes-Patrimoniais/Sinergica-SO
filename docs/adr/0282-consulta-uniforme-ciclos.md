---
name: "docs-adr-0282-consulta-uniforme-ciclos-md"
description: "Documento Sinérgica SO: ADR-0282 — Consulta uniforme de ciclos por Rotina"
alwaysApply: false
---

# ADR-0282 — Consulta uniforme de ciclos por Rotina

Status: proposta, não homologada.

Uma consulta comum identifica o modo exclusivamente no snapshot aprovado da Rotina e consulta a fonte já existente de prévia por calendário ou de Visitas contratuais vinculadas. Ela não cruza modos nem deduplica identidades diferentes por data. Cada linha informa sua origem, chave própria, vencimento e o alcance conhecido da fonte; feriado não declarado nunca é tratado como inexistente. A prévia por Visita exclui Visitas concluídas ou canceladas segundo sua fonte e não comprova completude do período. Calendário não comprova tratamento operacional nem feriados.

Leitura não cria ocorrência, tarefa ou OS. Gate privado nasce fechado, funções de origem mantêm suas autorizações e condições, EXECUTE revogado. Revisão de concorrência, segurança, cursores, limites e testes é necessária antes de ativação.
