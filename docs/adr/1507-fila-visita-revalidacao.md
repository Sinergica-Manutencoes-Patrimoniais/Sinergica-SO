---
name: "docs-adr-1507-fila-visita-revalidacao-md"
description: "Documento Sinérgica SO: ADR-1507 — Revalidação da fonte da fila de Visita"
alwaysApply: false
---

# ADR-1507 — Revalidação da fonte da fila de Visita

## Contexto
O estado da fila registra a decisão tomada naquele instante. A Visita, sua ponte, OS e outros fatos podem mudar depois, tornando antiga uma entrada antes candidata a aguardando. Reescrever o estado sem comando perderia o histórico da decisão.

## Decisão
Oferecer consultas novas, compatíveis com as anteriores, que acrescentam situação observada da fonte sob locks conservadores. Situação `conferida` significa apenas que a mesma verificação parcial da fila ainda é satisfeita; `verificacao` indica fonte ausente, divergente, Visita encerrada/suprimida ou vigência não comprovada; `cancelada` mantém a decisão anterior. A tela mostra decisão registrada e situação atual separadamente e não usa uma leitura antiga durante revalidação/erro.

Quando o gate de Visita estiver ligado, criação de novo Chamado de um ciclo que já possui entrada exige fila aguardando e fonte ainda candidata, sob o mesmo lock de ciclo usado pela fila. Entrada cancelada, em verificação ou fonte alterada bloqueiam novo Chamado; replays e Chamado já existente preservam o comportamento anterior. A ausência de fila não altera o fluxo legado. O comando não muda entradas nem chama Auvo.

## Limites
A verificação é parcial e baseada apenas nas fontes consultadas e nas guardas de vigência existentes; não prova exclusividade fora delas nem homologação. Avaliar todos os outros consumidores e alterações após a leitura, custo de locks, integração com fontes não mapeadas, concorrência nas duas ordens e revisão adversarial. Gates e guarda de aprovação permanecem fechados.
