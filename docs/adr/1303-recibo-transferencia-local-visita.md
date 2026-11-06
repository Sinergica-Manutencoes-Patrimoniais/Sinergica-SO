---
name: "docs-adr-1303-recibo-transferencia-local-visita-md"
description: "Documento Sinérgica SO: ADR-1303 — Recibo de transferência local entre Visitas"
alwaysApply: false
---

# ADR-1303 — Recibo de transferência local entre Visitas

## Decisão

Permitir consulta autenticada ao recibo de uma transferência já registrada,
com o mesmo ator, Cliente, requestId e conteúdo canônico. Reusar o lock de
request do comando e verificar autorização atual antes de retornar resultado.
Uma consulta sem recibo não prova falha, não cancela e não autoriza outro
request. A função não move OS nem chama Auvo.

A interface oferece consulta sob flag própria desligada; a repetição do
pedido original permanece separada. A migration não abre o gate operacional.

## Antes de habilitar

Validar ambas modalidades, payload e datas, sessão e revogação, propriedade
das Visitas, concorrência nas duas ordens, replay, RLS/FORCE, compatibilidade,
perda de resposta e revisão adversarial. O recibo registra operação passada,
não assegura que o vínculo permaneça atual.
