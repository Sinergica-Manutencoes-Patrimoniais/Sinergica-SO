---
name: "docs-adr-0575-leitura-retorno-origem-visita-md"
description: "Documento Sinérgica SO: ADR-0575 — Leitura da origem de retorno por Visita"
alwaysApply: false
---

# ADR-0575 — Leitura da origem de retorno por Visita

Status: preparada, gates fechados, não aplicada nem homologada. Um conjunto somente leitura valida OS/Cliente, resolvedor unificado 0726, origem por Visita e snapshot aprovado com identidade de perguntas inequívoca; outra consulta pagina IDs e obrigatoriedade congelada, tratando contrato ausente como indeterminado. Não interpreta prosa nem presume autenticidade externa.

Não cria retorno, valida resposta, altera fila ou autoriza aprovação/execução. O bloqueio 0729 permanece: consumidores de escrita, atestações, pendências e fechamento ainda exigem adaptação conjunta e concorrência comprovada. Testes e revisão adversarial obrigatórios.
