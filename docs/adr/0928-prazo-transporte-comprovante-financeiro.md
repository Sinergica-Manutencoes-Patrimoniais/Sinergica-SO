# ADR-0928 — Prazo do download de comprovante

## Contexto

ADR-0927 limita bytes, mas um Storage que aceita a conexão e não termina o corpo pode manter a requisição e recursos ocupados indefinidamente.

## Decisão

O transporte usa `AbortSignal.timeout` com prazo total de 15 segundos, iniciado no `fetch` e vigente também na leitura do corpo. O prazo curto injetável é usado apenas em testes. Falha ou prazo esgotado retorna 503 genérico; bytes parciais nunca são entregues. O máximo de 10 MiB e a revalidação posterior de autorização permanecem inalterados.

## Limites e implantação

O prazo é técnico e pode afetar usuários em conexões lentas; medir no Edge Runtime e Storage reais antes do rollout. Não limita autenticação, rate limit ou consultas ao banco, nem elimina corrida após a última revalidação. Não altera dados, gates ou ACLs; sem deploy. Reversão é restaurar o transporte anterior por entrega coordenada, retomando o risco de espera indefinida. Revisão adversarial continua obrigatória.
