# ADR-1019 — Fotografia das declarações de feriado

Status: preparação privada, não homologada.

Preparar leitura paginada por Cliente, contrato e período com resumo e assinatura do conjunto de declarações retornáveis na mesma instrução SQL. A assinatura identifica mudanças observáveis entre páginas; não é atestado de fonte oficial, nem impede uma alteração revertida ou mudança depois da última consulta. Limitar tamanho do conjunto e preservar as regras de escopo e autorização existentes.

O comando exige ator, capacidade `plano.gerir`, READ COMMITTED e travas de autorização e gates; nasce privado e com gate fechado. Não substitui a origem de feriados oficiais nem gera Visitas. Validar privacidade, limites, paginação, concorrência de escritores e gate, revogação, FORCE RLS, índices e revisão adversarial antes de integração e ativação.
