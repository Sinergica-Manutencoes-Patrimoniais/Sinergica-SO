# ADR 0799 — Mediação do vínculo de intervalo

Status: proposta; não homologada.

A interface usa uma leitura mediada por Cliente, disponibilidade e intervalo, que retorna as últimas 100 declarações de vínculo e sinaliza eventual truncamento. A leitura exige `capacidade.gerir`, mesmo gate fechado da escrita e correspondência da disponibilidade com Cliente e intervalo. Não concede leitura direta de tabelas. A escrita mediada apenas encaminha ao comando privado da ADR 0798, que serializa gate, autorização, disponibilidade e idempotência; não transforma a afirmação em cobertura comprovada.

A interface conserva por sessão a mesma tentativa até resposta validada, impedindo substituição de pedido divergente. A revisão exibida refere-se somente à revisão atual da disponibilidade; eventos anteriores são histórico e não são transpostos. Nada altera descontos ou comprova saldo. A leitura observa um snapshot por consulta: revogação após o início poderá alcançar a próxima consulta; não se afirma revogação retroativa em resultados já entregues. Gate e flag visual seguem desligados; revisão adversarial e homologação pendentes.
