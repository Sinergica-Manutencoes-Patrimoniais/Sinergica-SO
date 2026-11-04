# ADR-0200 — Serialização entre triagem e resolução automática

## Decisão

Reforçar a guarda de inserção de resolução para adquirir lock do envelope e recusar qualquer nova resolução automática após indicação manual, independentemente do gate de retificação. A indicação 0418 já bloqueia envelope e recusa resolução identificada prévia; assim, no código preparado, uma decisão ganha a corrida sem ser silenciosamente sobreposta pela outra. O histórico da indicação permanece preservado.

## Limites

Não existe ainda resolução manual aprovada de OS a partir da indicação, nem prova de que todos os consumidores usem esta tabela/lock; isso impede ativação até inventário e revisão. Outras resoluções anteriores ao vínculo não provam processamento. Funções e gates existentes seguem fechados; sem teste/aplicação.
