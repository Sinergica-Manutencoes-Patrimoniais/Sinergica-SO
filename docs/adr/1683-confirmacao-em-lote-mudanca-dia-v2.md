---
name: "adr-1683-confirmacao-em-lote-mudanca-dia-v2"
description: "Reduz consultas repetidas na confirmação atômica da mudança de dia S166"
alwaysApply: false
---

# ADR-1683 — Confirmação em lote da mudança de dia V2

## Estado

Aceito para implementação no candidato S166. Não abre gates, não aumenta o limite de 500 e não autoriza merge, homologação ou deploy. Executar a validação integrada de lote antes de qualquer PASS.

## Contexto

O E2E isolado confirmou que a fotografia de 501 Visitas é preparada e selada, mas a RPC de confirmação termina com `57014` após 8.011 ms (`canceling statement due to statement timeout`). A confirmação chama `sso_editar_visita` uma vez por Visita. Cada chamada repete busca, lock, autorização, validação, atualização, auditoria e gravação do comando, embora a RPC externa já tenha bloqueado e conferido o conjunto inteiro dentro da mesma transação.

## Decisão

- Manter toda confirmação em uma transação PostgreSQL; nunca dividir efeitos operacionais em commits por página.
- Substituir as chamadas repetidas a `sso_editar_visita` por atualização em conjunto das Visitas sem feriado, usando a fotografia selada e os bloqueios já adquiridos.
- Preservar validação atual de autorização, revisão, estado, responsável ativo, origem, ocorrências, OS, feriados e gates; preservar os triggers existentes de Visita e aplicar o fuso da regra vigente como no comando individual. Quando o gate de composição estiver habilitado, adquirir o advisory lock escritor por Visita em ordem estável antes dos locks de tabela e linha.
- Criar um comando idempotente por Visita e evento de auditoria com os snapshots completos anterior e posterior, no mesmo formato produzido por `sso_editar_visita`.
- Manter supressões por feriado no caminho mediado existente, pois possuem regras e auditoria próprias.
- Não mudar orçamento, prazo PostgREST nem gates para mascarar a duração. O gate V2 e o teto operacional permanecem fechados até medição integrada e revisão adversarial.

## Consequências

A otimização reduz round-trips internos repetidos sem mudar o protocolo público nem a semântica de replay. A bateria integrada deverá provar rollback total após falha tardia, equivalência de recibos/auditoria/comandos, concorrência com gate de composição habilitado e desempenho no clone descartável. Se qualquer invariante não puder ser mantida, reverter a otimização e conservar o bloqueio acima de 500.
