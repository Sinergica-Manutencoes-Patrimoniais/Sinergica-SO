# ADR-1227 — Lista atual de materiais mediada no Portal

## Decisão

Preparar leitura autenticada da lista atual de materiais por ator, Cliente e OS, reutilizando a autorização transacional e o gate de visibilidade do ADR-1220. A resposta projeta no servidor somente descrição, quantidade e unidade das linhas publicadas, preservando sua ordem e recusando dados incompatíveis com o contrato público. A leitura não altera a lista nem informa disponibilidade.

## Limites e gates

Manter a flag desligada até validar isolamento entre Clientes, revogação, gate, RLS/FORCE, tipos e conteúdo textual, paginação, retirada ou nova publicação concorrentes e ordem das travas. A consulta legada não é revogada por esta migration: consumidores e exposição direta devem ser inventariados e corrigidos antes de homologar. Revisão adversarial e rollout coordenado continuam obrigatórios.
