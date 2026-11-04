# ADR-1001 — Conferência do mapeamento de categoria

Status: preparação privada, não homologada.

Preparar consulta do texto atual e do vínculo explícito de um Componente, por ator e Cliente autorizados, incluindo revisão e estado de validade. A correspondência só é atual quando Cliente, texto e categoria ativa permanecem compatíveis; ausência de vínculo ou divergência não autoriza Equipment. Preparar listagem paginada de categorias ativas para escolha humana, sem inferir ID por nome. Os dados não alteram a fila de sincronização.

Ambas as consultas exigem gate e capacidade cadastral, autorização sob trava e READ COMMITTED; funções privadas. Leituras separadas não constituem snapshot e a gravação revalida texto, categoria e revisão. Validar RLS/FORCE, concorrência, paginação, revogação, acessibilidade e volume antes de ativar.
