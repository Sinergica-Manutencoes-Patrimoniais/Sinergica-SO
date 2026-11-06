---
name: "docs-adr-0666-descricao-promocao-origem-visita-md"
description: "Documento Sinérgica SO: ADR-0666 — Descrição histórica na promoção de origem Visita"
alwaysApply: false
---

# ADR-0666 — Descrição histórica na promoção de origem Visita

A descrição continua sendo exclusivamente texto único do questionário congelado na versão aprovada. Para vínculo de Visita, a identificação da origem passa pelo resolvedor privado 0726, que exige Cliente, ocorrência, alvo, série e semana comprovados; a versão e Rotina devem coincidir com o retorno. Calendário preserva o caminho anterior. Ausência, ambiguidade ou texto inválido bloqueiam a promoção; não há fallback para texto atual.

A mudança não libera consumidores de retorno, execução ou os gates existentes. A guarda 0729 continua ativa, logo a existência de uma origem não autoriza criar ou validar retorno. Dependências, concorrência, testes e revisão seguem pendentes.
