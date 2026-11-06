# ADR-1079 — Prévia da mudança de dia pela semana de origem

Status: proposta local, não aplicada nem homologada.

## Decisão

A prévia deve considerar a data original da semana contratual, a data atual da Visita e a data proposta. Assim, uma alteração na mesma semana não omite a Visita somente porque seu início atual antecede a vigência. A prévia não identifica como candidata automática a Visita com horário/fuso divergente da regra original ou com vínculo ativo a OS que possui identificação ou sincronização Auvo; tampouco a que tenha passado. Tais casos são apresentados para preservar e conferir. A prévia continua sem alterar datas, regras, ocorrências ou dados externos.

## Limites

A classificação não comprova ausência de outros tipos de exceções, nem a cobertura de feriados ou de Visitas legadas; não autoriza reprogramação. Antes de aplicá-la, validar fusos e horário de verão, vigências na mesma semana, alterações concorrentes, contratos, autorização e paginação. A implementação efetiva da mudança exige modelo de versão vigente por Visita que preserve a origem imutável, tratamento de feriados, ocorrências, exceções, OS e identificadores Auvo, além de revisão adversarial.
