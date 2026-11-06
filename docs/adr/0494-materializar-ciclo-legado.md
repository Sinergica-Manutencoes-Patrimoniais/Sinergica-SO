---
name: "docs-adr-0494-materializar-ciclo-legado-md"
description: "Documento Sinérgica SO: ADR-0494 — Materialização individual com legado associado"
alwaysApply: false
---

# ADR-0494 — Materialização individual com legado associado

Status: preparado, gate fechado, não aplicado nem homologado. Para ocorrência preparada por calendário, o comando confirma Plano ativo, vínculo humano atual, Cliente/alvo/questionário, índice e data reais do Plano legado; insere ou reutiliza somente aquele ciclo por chave canônica e chama a integração 0718 na mesma transação. Não cria OS, envia Auvo nem roda o gerador legado em lote.

Não aceita vencidos anteriores à data UTC do servidor: eles exigem decisão PCM e o fuso civil do Plano ainda não está definido, portanto o gate não deve ser habilitado. Relação declarada não prova equivalência geral. Casos por Visita ou Grupo Quantitativo, concorrência com geradores/OS, efeitos de triggers, identidade, política de revisão e reconciliação exigem análise, testes e revisão adversarial antes de ativação.
