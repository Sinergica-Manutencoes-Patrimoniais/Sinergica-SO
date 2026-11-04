# ADR-1483 — Vigência e continuidade na integração legada

## Contexto
Ocorrência preparada pode ter sido criada por uma versão que depois perdeu vigência. A materialização/vinculação legada consultava a versão de origem sem conferir qual versão rege o vencimento; isso poderia reintroduzir escopo retirado pela revisão.

## Decisão
Com o protocolo de continuidade ligado, os caminhos de materializar ou vincular ocorrência legada conferem a versão aprovada única vigente no vencimento. Se diferente da versão de origem, exigem Rotina lógica e alvo equivalentes no snapshot vigente e o selo de manter da revisão. Isso reutiliza as proteções de calendário e Visita sem reescrever ocorrência, vínculos existentes ou OS. Replay já confirmado permanece idempotente. Gate desligado preserva comportamento anterior.

## Limites
Requer inventário de todos os caminhos que escrevem no legado, revisão de datas reprogramadas e casos de vencimento histórico, testes concorrentes e revisão adversarial. Não substitui decisão PCM para vencidos, não valida equivalência PMOC e não libera aprovação ou deploy.
