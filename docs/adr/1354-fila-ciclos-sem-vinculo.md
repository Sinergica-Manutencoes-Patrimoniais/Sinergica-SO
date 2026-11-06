# ADR 1354 — Ciclos sem vínculo na fila de conferência PCM

## Contexto

Um ciclo preparado pode não ter vínculo com uma preventiva legada, inclusive quando o alvo é Grupo Quantitativo. A ausência de vínculo não prova que não exista OS, tarefa ou execução em outra fonte.

## Decisão

Ampliar a fila local com estado explícito `verificacao`. Somente quando o diagnóstico existente informar `sem_vinculo` e um gate adicional estiver habilitado, o PCM poderá incluir manualmente o ciclo como item a conferir. Não será classificado como execução pendente comprovada nem ficará elegível para envio automático. A identidade canônica, autorização, revisão, motivo, auditoria e cancelamento reutilizam o comando existente; cancelamento também aceita esse novo estado. Estado `indeterminado` por qualquer outro motivo continua recusado.

## Consequências

Não consulta todas as fontes nem comprova ausência de efeitos externos. A alteração exige compatibilidade coordenada dos leitores estritos, validação da identidade entre versões, concorrência de criação de vínculo e de fontes externas, autorização, RLS/FORCE e revisão adversarial. Gates permanecem fechados e não há OS ou tarefa Auvo.
