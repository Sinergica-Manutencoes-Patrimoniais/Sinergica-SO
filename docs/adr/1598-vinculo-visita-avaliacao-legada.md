---
name: "docs-adr-1598-vinculo-visita-avaliacao-legada-md"
description: "Documento Sinérgica SO: ADR 1598: avaliação recebida impede nova ponte de Visita"
alwaysApply: false
---

# ADR 1598: avaliação recebida impede nova ponte de Visita

Uma avaliação já recebida exige reconciliação antes de uma nova ponte entre Visita e ocorrência legada. O núcleo de vinculação verifica a evidência sob trava compartilhada até o fim da transação. Replay do pedido já concluído mantém o recibo histórico e a autorização corrente; nenhuma OS ou avaliação é alterada.
