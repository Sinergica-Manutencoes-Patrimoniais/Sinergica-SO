# ADR-0707 — Acesso aos comandos de lote de Visitas

Status: preparada; não aplicada nem homologada.

As interfaces de 0900 e 0902 chamam diretamente suas RPCs, mas ambas revogam `EXECUTE` de `authenticated` e nenhuma migration posterior o concede. Assim, mesmo após aprovação e liberação dos gates internos, as telas não conseguem acessar os comandos.

Conceder somente `EXECUTE` dessas duas funções a `authenticated`; elas continuam condicionadas aos gates privados desligados e à autorização vigente de `plano.gerir` e `visita.confirmar` no Cliente. Não conceder tabelas, service role ou funções internas, não ativar gates nem enviar Auvo. O lote continua atômico e mantém a idempotência de request existente.

A concessão não homologa os comandos: faltam testes reais de autorização, isolamento, retry e concorrência, incluindo ordem de locks do lote legado, e revisão adversarial antes de qualquer ativação.
