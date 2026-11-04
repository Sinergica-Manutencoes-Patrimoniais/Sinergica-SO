# ADR-0070 — Consulta contextual paginada de Visitas

**Status:** decisão para implementação local E01-S171. **Data:** 2026-10-27.

O servidor expõe listagem por Cliente e intervalo semiaberto, com autorização atual, limite máximo e cursor composto por instante e ID. Ordenação usa a chave `(inicio_em, id)`; mesmo horário não omite Visitas. Detalhe exige Cliente e ID coerentes e retorna dados operacionais e contagens vigentes, sem anexar listas ilimitadas de OS/equipe ou dados financeiros. Visitas mudadas de horário durante paginação podem mudar de página; interface deve reiniciar a listagem após alteração.

Permissão `visita.confirmar` é conservadora até E01-S170 definir leitura abrangente; não é concessão automática. Listas globais, históricos de vínculos, nomes e seletores precisam de contratos próprios e paginação. Consultas não escrevem nem disparam integração.
