# ADR-1182 — Busca paginada da identidade T−24

Status: proposta local, não conectada nem homologada.

Preparar busca paginada por identidade estável da OS com transporte injetado. A conclusão só é indicada quando o contrato e o leitor comprovam cobertura integral, cada página informa continuação ou término explicitamente e nenhum limite, erro, cursor repetido, registro ilegível ou identidade sem campo ocorre. O filtro remoto não é presumido exato: registros de outras identidades são descartados localmente, enquanto identidade ausente torna a busca inconclusiva.

Limite de páginas protege recursos e não prova ausência. Filtros por intervalo de `taskDate` não demonstram cobertura histórica integral por si só. Sem evidência independente da cobertura, retornar busca inconclusiva mesmo quando não há resultado. Código não tem credenciais ou rede; validar contrato real, paginação, datas, exclusões, consistência e revisão adversarial antes de conectar.
