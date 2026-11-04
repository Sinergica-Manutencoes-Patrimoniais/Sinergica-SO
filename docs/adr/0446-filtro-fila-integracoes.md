# ADR-0446 — filtro por estado da fila de integração

Status: proposto; não aplicado nem homologado. A projeção filtra o estado persistido antes da paginação por UUID e mantém o escopo e a autorização da fila existente. Processando e erro continuam classificados como resultado remoto incerto; enviado não significa confirmação remota. Não expõe payload nem aciona a integração. UI e RPC permanecem sob flag/gate fechados; isolamento e paginação dinâmica precisam de testes.
