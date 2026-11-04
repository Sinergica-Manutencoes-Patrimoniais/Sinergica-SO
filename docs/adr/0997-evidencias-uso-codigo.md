# ADR-0997 — Evidências observáveis de uso do código

Status: preparação privada, não homologada.

Para apoiar a conferência de cadastros legados, preparar consulta de um único Sistema ou Componente no Cliente autorizado. Retornar somente indicadores de vínculo atual com OS, identificadores Auvo, aliases e marcos já registrados. A ausência desses indicadores é indeterminada: não demonstra ausência de impressão, sincronização anterior, referências removidas ou aprovação histórica e não habilita rascunho. A consulta não executa backfill nem altera dados.

O mediador exige identidade, capacidade de gestão, trava de autorização e gate próprio em READ COMMITTED; nasce privado e fechado. Há consulta por existência, sem paginação de detalhes ou garantia de fotografia entre tabelas sob mudanças concorrentes. Validar FORCE RLS, autorização e revogação, integridade de Cliente, desempenho e revisão adversarial antes de conceder acesso.
