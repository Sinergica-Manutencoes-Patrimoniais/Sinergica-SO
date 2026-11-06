# ADR 1447 — Mediação da classificação de retorno

As operações autenticadas de listagem e classificação usam entradas próprias, com gates independentes desligados, autorização de execução para o Cliente e coordenação de autorização. Os núcleos permanecem privados. A classificação continua declaração manual e não comprova cobertura nem execução.

Validar ACL, sessão, concorrência, isolamento, replay, classificação por origem e revisão adversarial antes de habilitar.
