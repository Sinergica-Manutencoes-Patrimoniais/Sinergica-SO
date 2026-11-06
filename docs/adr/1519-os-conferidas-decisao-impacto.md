# ADR-1519 — Mostrar OS conhecidas na decisão de impacto

## Contexto
A decisão fotografa OS, mas a tela não mostrava ao PCM as OS de fontes conhecidas relacionadas à ocorrência. A confirmação da comparação não cobria mudanças nessas OS.

## Decisão
A comparação versionada reúne as OS ativas conhecidas nas pontes legadas, nos vínculos explícitos e nos chamados/grupos fotografados para a ocorrência. Retorna somente ID, status e data de atualização das OS do Cliente; divergência de Cliente é sinalizada sem expor IDs de outros Clientes. Acima de 100 OS a comparação é recusada para reconciliação. A decisão transacional captura as mesmas fontes sob travas e compara a lista exibida, rejeitando alterações concorrentes.

## Consequências
A listagem é parcial: ausência de OS não prova inexistência em fontes não relacionadas. Nenhuma OS é alterada ou encerrada. Pedidos comparados já concluídos preservam replay; pedidos antigos ainda não gravados devem ser conferidos novamente. Os gates existentes e guarda 1045 permanecem; medir custo/concorrência e revisar adversarialmente antes de ativar.
