---
name: "docs-adr-1300-titularidade-criacao-visita-md"
description: "Documento Sinérgica SO: ADR-1300 — Titularidade da tentativa de criação de Visita"
alwaysApply: false
---

# ADR-1300 — Titularidade da tentativa de criação de Visita

## Contexto

Um request e seu payload podem ser conhecidos por outro operador do mesmo Cliente. A ausência de recibo não comprova quem iniciou o pedido. A ADR-1299 não deve ser habilitada nessa condição.

## Decisão

Para novas tentativas que admitam cancelamento, o servidor emite o request aleatório e registra previamente ator, Cliente e payload sob gate fechado. O cliente guarda o request recebido antes de pedir a criação. A criação sob a trava do request rejeita ator, Cliente ou payload diferentes de uma reserva existente. O cancelamento só atua sobre reserva pertencente ao ator e payload exatos; tentativas legadas sem reserva não podem ser canceladas por essa via, mas continuam elegíveis ao recibo ou replay existentes.

## Consequências

Uma resposta perdida da reserva não cria Visita; pode deixar reserva órfã sem efeitos operacionais. A reserva não autoriza criação sem nova validação no comando proprietário. A implantação requer ordem coordenada, gates fechados, provas de corrida e idempotência, segurança, acesso legado e revisão adversarial. Esta decisão complementa e restringe a ADR-1299.
