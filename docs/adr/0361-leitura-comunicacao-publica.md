# ADR-0361 — Consulta individual de comunicação pública

Status: proposta; gate fechado e sem testes.

A consulta individual revalida sessão, Conta, OS e publicação vigente antes de entregar a mesma projeção pública da fila. É somente leitura: não cria evento de leitura, ciência, confirmação ou notificação, pois esses efeitos não são exigidos pelo contrato de S183. Não expõe campos internos nem presume que o Cliente tenha lido o conteúdo. Gate e funções permanecem fechados até revisão de isolamento, retirada concorrente e cache.
