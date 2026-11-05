# ADR 1613 — Revisão obsoleta na preparação de Visita

Status: aceito para implementação; homologação pendente.

As guardas explícitas de revisão no preparo por Visita, na identidade canônica e no lote retornam `P0016` em vez de `40001`, evitando reexecução automática para uma rejeição de negócio. Erros reais de serialização permanecem inalterados. A interface libera nova conferência somente após rejeição inequívoca na primeira tentativa, com sessão e pedido verificados; replay incerto é preservado. Nenhuma OS ou tarefa Auvo é criada.
