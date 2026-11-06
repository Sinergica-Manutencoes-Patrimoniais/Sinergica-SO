# ADR-1083 — Alinhamento da prévia de mudança de dia

Status: proposta local, não aplicada nem homologada.

## Decisão

A prévia deve classificar como candidata somente a Visita cuja regra efetiva seja a última regra da série, com dia e hora ainda alinhados a essa regra. A regra original permanece identificada como origem histórica; uma Visita já movida por versão anterior passa a ser comparada com sua regra efetiva. Isso aproxima a lista de revisões exibida do conjunto aceito pelo comando transacional, sem tornar a consulta uma fotografia atômica.

## Limites

Novos registros, alterações, feriados, sincronização ou revogação podem ocorrer entre páginas e até o envio. O comando deve revalidar tudo sob locks e pode recusar. Esta decisão não implementa supressão em feriados nem reconciliação de ocorrências preparadas; validar também fusos, exceções, paginação, plano de execução e revisão adversarial antes de habilitar.
