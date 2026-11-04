# ADR 1361 — Categoria de negócio da candidata T−24

## Contexto

O protocolo técnico de reparos é compartilhado por corretiva e, quando habilitada, emergencial. Exibir somente o protocolo técnico pode ocultar a categoria real da OS ou uma alteração posterior.

## Decisão

Adicionar consulta autorizada à categoria atual e à fotografia imutável da candidata, quando existente. Tentativas anteriores sem fotografia são identificadas como históricas, sem inferência. A consulta aproveita o diagnóstico autorizado existente, não verifica contrato Auvo e não autoriza envio.

## Consequências

O resultado é pontual e não substitui a revalidação transacional. Exige testes de permissão, mudança de categoria, tentativas legadas, RLS/FORCE, sessão e revisão adversarial. Sem efeitos externos.
