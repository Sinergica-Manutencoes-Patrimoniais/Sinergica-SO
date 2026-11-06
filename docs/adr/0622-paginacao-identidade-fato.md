# ADR-0622 — Paginação das opções de identidade de fato

Consulta usa cursor por vínculo e limite validado; seleção permanece entre páginas carregadas e decisão continua revalidada no comando. O modelo atual restringe snapshot a um vínculo, mas a paginação não supõe essa restrição. Inserções concorrentes antes do cursor exigem reconsulta. Gate fechado; testar permissões e concorrência antes de ativar.
