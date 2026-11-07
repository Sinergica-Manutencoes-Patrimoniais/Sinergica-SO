---
name: "docs-adr-1207-recuperacao-observacao-reserva-md"
description: "Documento Sinérgica SO: ADR-1207 — Recuperação do recibo de observação de reserva"
alwaysApply: false
---

# ADR-1207 — Recuperação do recibo de observação de reserva

## Decisão

Preparar consulta autenticada do recibo de uma observação já registrada por requestId, mesmo após a reserva sair da fila. A leitura exige o mesmo ator, Cliente atual do Componente e capacidade `cadastro.gerir`; não aceita busca por texto e não expõe observações de outra pessoa. Ausência, transferência e falta de autorização produzem resposta indistinguível.

O recibo comprova somente o registro local da observação, não o estado do Equipment no Auvo. Não recria reserva, não libera reenvio e não altera qualquer dado externo. A tela mantém a tentativa se a consulta falhar ou a sessão mudar.

## Gates

Flag e gate continuam fechados até testes de autorização/revogação, transferência concorrente, reentrega, exclusão de reserva, privacidade e revisão adversarial. A leitura não substitui reconciliação da fila.
