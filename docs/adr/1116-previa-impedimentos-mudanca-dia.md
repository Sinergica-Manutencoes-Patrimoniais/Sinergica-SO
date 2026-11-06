---
name: "docs-adr-1116-previa-impedimentos-mudanca-dia-md"
description: "Documento Sinérgica SO: ADR-1116 — Impedimentos da mudança do dia na prévia"
alwaysApply: false
---

# ADR-1116 — Impedimentos da mudança do dia na prévia

Status: proposta local, não aplicada nem homologada.

## Decisão

A prévia poderá informar, por Visita e data proposta, se há feriado declarado aplicável ou ocorrência preparada. A leitura usa a prévia existente, preserva sua classificação e paginação, exige as mesmas capacidades e uma trava compartilhada dos feriados. A informação é diagnóstico: não suprime, move ou altera Visitas, ocorrências ou obrigações por calendário.

## Limites

A leitura por páginas não é fotografia atômica; criação de ocorrências ou alteração de Visitas pode ocorrer após a leitura. O comando segue responsável por revalidar e recusar situações não implementadas. Faltam conciliar ocorrências e suprimir Visitas em feriados, inventariar fontes legadas e testar autorização, concorrência, privacidade e revisão adversarial. Gate permanece fechado.
