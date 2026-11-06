# ADR-1028 — Consulta das supressões por feriado

Status: preparação privada, não homologada.

Preparar leitura paginada do histórico de supressões por declaração, inclusive após sua retirada, apresentando série, regra, semana, data e estado da revogação. Exigir ator, Cliente e capacidades do Plano/Visita sob gates e trava de autorização. Leitura não altera data, não gera Visita nem presume que a lista de feriados seja oficial.

Paginação não é snapshot e histórico é limitado às supressões deste mecanismo. Manter função privada e gate fechado; validar RLS/FORCE, acesso cruzado, revogação de permissão, concorrência, índices, acessibilidade e revisão adversarial. A tela deve apresentar ações explícitas e nunca sugerir que revogação gera reposição.
