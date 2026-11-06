---
name: "docs-adr-1603-previsoes-comparacao-sem-retry-md"
description: "Documento Sinérgica SO: ADR-1603: conflito definitivo nas prévias de substituição"
alwaysApply: false
---

# ADR-1603: conflito definitivo nas prévias de substituição

As prévias de nova data de Calendário e de nova Visita conferem a comparação apresentada pelo PCM. Comparação obsoleta é rejeição definitiva, não falha transitória de serialização. O SQLSTATE `40001` provoca repetição automática no PostgREST e pode deixar a interface aguardando.

As duas prévias passam a sinalizar somente `comparacao_obsoleta` com `P0010`, alinhado à decisão comparada da ADR-1601. Outros conflitos e os locks permanecem inalterados. A interface já trata qualquer erro de prévia como indisponibilidade, descarta opções e pede atualização.

A mudança preserva as assinaturas, privilégios, dados e comportamento de comparação; consumidores que inspecionem especificamente `40001` para esse conflito devem reconhecer `P0010` e a mensagem. A alteração não autoriza deploy nem execução externa.
