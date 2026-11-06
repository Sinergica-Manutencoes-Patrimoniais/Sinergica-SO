# ADR-0577 — Criação selecionada de localizações

Status: proposta; gate fechado, não homologada.

Permitir ao PCM selecionar até 50 Áreas, Locais ou Sublocais, na ordem de dependência. Cada item inclui atributos e referência ao pai explicitamente conferidos, além de requestId próprio. O servidor compara o retrato integral da linha e chama o comando canônico de incorporação, encadeando revisões; o comando resolve o pai somente por linha anteriormente incorporada ou atualização da mesma recepção. O gate de aprovação e suas validações permanecem obrigatórios.

Qualquer falha reverte toda a transação. O resultado conserva os resultados individuais e a repetição do requestId do lote é idempotente. Nenhum ativo é criado. A transação usa a salvaguarda de sincronização Auvo existente; confirmar todos os gatilhos em revisão e testes antes de habilitar. RPC e gate permanecem fechados; interface e testes ainda pendentes.
