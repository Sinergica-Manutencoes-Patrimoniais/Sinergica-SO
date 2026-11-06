# ADR-1298 — Recibo da criação de Visita

## Contexto

Uma Visita pode ter sido criada mesmo se a resposta ao navegador for perdida. O usuário precisa consultar o mesmo pedido sem criar outra Visita.

## Decisão

Adicionar consulta autenticada e restrita ao mesmo ator e Cliente, com capacidade atual `visita.confirmar`, gate fechado por padrão, payload canônico integral e a mesma trava por request da criação. O recibo só é devolvido se a Visita ainda pertencer ao Cliente. A consulta não altera a Visita nem confirma qualquer envio externo.

## Consequências

Recibo encontrado pode recuperar a interface. Recibo indisponível não prova que o pedido falhou ou não será recebido depois, e não autoriza gerar outro request. Testes de concorrência, revogação, fusos, RLS e revisão adversarial são necessários antes da liberação.
