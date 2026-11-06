---
name: "docs-adr-0791-e01-s172-snapshot-capacidade-parcial-md"
description: "Documento Sinérgica SO: ADR-0791: snapshot combinado parcial para capacidade semanal"
alwaysApply: false
---

# ADR-0791: snapshot combinado parcial para capacidade semanal

Status: proposta em gates fechados; homologação pendente.

## Decisão

Reunir em uma única chamada STABLE as fontes autorizadas 0981 e 0988. PostgreSQL avalia as leituras no mesmo snapshot da instrução, evitando combinar listas lidas em instantes distintos. Cada lista é limitada a 100 itens e sinaliza se atingiu o limite; não há promessa de paginação consistente entre chamadas. Os gates e permissões das fontes continuam obrigatórios e as funções internas permanecem sem acesso direto. A projeção não altera dados.

Na interface, deduplicar OS por identidade, excluir conflitos de OS com ocorrência compartilhada e somar somente as linhas retornadas de ocorrências sem OS identificada. Separar HH próprios mais acompanhamento dos terceiros; nulos e zero não provam completude. A semana da Visita usa programação; ocorrências usam vencimento original. Os subtotais são aproximações declaradas no mesmo snapshot, não saldo, capacidade efetiva, resultado executado ou demanda completa.

## Limites

OS sem Visita podem estar fora da projeção, ocorrências preparadas não possuem estado confiável de execução e a data programada de ocorrência não é sempre conhecida. Continuidades, vínculos não identificados, histórico, conflitos e origem Visita/Grupo não estão integralmente comprovados. Mesmo com ambas listas abaixo do limite, `completude` permanece desconhecida. Além de gates fechados, exigem-se cobertura, concorrência, revisão adversarial e homologação antes de qualquer liberação.
