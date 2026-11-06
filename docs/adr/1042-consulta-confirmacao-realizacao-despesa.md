# ADR-1042 — Consulta de confirmação da realização de despesa

Status: preparado, não aplicado ou testado; gate fechado.

Uma entrada privada permite ao ator original consultar confirmação de uma tentativa de realização, informando o pedido integral e o contexto de Cliente/Visita. O servidor confere comando e registro histórico correspondentes, autorização atual e identidade, sem devolver caminho de arquivo. A consulta não executa operação, não comprova integridade dos bytes nem afirma inexistência de comando quando a resposta for indisponível.

O cliente só limpa a tentativa após recibo compatível e conferência das chaves locais. Tentativas antigas sem protocolo podem ser confirmadas por esta via, mas não devem ser reenviadas por caminho presumido. Testar RLS/FORCE, concorrência, revogação, serialização, alterações financeiras posteriores, privacidade e recuperação parcial; revisão adversarial e rollout coordenado permanecem obrigatórios.
