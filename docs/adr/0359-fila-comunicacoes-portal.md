# ADR-0359 — Fila de comunicações públicas

Status: proposta; gates fechados, sem testes.

O Portal apresenta uma consulta paginada por Conta, reunindo somente comunicações de visita e pendências explicitamente publicadas e ainda vigentes, respeitando gates de origem, revisão e vínculo de OS. Não cria notificações, não marca leitura nem envia mensagens. O total e quantidade não lida são desconhecidos, não zero. A fila não deduz ausência de comunicação quando alguma fonte estiver desabilitada; texto livre foi aprovado para o Portal, mas ainda depende de revisão humana contra informação sensível. Isolamento, retirada, paginação e concorrência precisam de testes antes de ativar.
