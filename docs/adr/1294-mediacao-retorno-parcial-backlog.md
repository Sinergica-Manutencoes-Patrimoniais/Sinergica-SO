# ADR 1294 — Mediação do retorno parcial ao Backlog

## Contexto

A tela de retorno parcial usa núcleos transacionais privados. Sem uma entrada autenticada, a jornada não consegue consultar condições nem registrar o restante revisado.

## Decisão

Adicionar entradas mediadas que verificam identidade explícita do ator e delegam aos núcleos existentes, preservando seus gates, capacidades, revisões, trilhas e recusas de concorrência. Não conceder acesso direto às tabelas ou ao núcleo. Retorno parcial continua dependente de revisão do PCM e não comprova parada remota nem cria OS ou tarefa Auvo.

## Implantação e retorno

Entradas aditivas e flag de interface desligada. Manter gates existentes fechados até validar autorização/revogação, cadeia de continuidade, concorrência, replay, isolamento, RLS/FORCE e revisão adversarial. Desligar a flag reverte a interface sem remover histórico. Não interpretar a existência da entrada como liberação operacional.
