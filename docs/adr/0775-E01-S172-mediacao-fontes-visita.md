# ADR-0775: mediação das fontes de Visita

Status: proposta preparada; gates fechados e homologação pendente.

A função interna da migração 0356 lista fontes por Cliente e semana, mas não é acessível a usuários autenticados. A interface precisa de uma fronteira que preserve sua autorização e o gate de origem sem conceder acesso direto a essa função.

Criar gate adicional fechado por padrão e mediador de leitura com EXECUTE apenas para authenticated. O mediador valida ação atual `capacidade.gerir`, delega à função 0356, que também valida ação, gate, escopo, semana e paginação, e não concede privilégios sobre tabelas ou função interna. A resposta permanece parcial, com `completude = desconhecida`; não representa HH nem saldo. A interface só chama a mediação existente sob suas flags, sem efeitos externos.

Revisão adversarial e testes integrados, incluindo paginação, isolamento Cliente, revogação e concorrência, permanecem obrigatórios antes de abrir qualquer gate.
