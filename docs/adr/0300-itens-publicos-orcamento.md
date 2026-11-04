# ADR-0300 — Snapshot estruturado público do orçamento

Status: proposta; não ativar sem integração de publicação, decisão e exportação e revisão adversarial.

Novas publicações podem registrar atomicamente itens públicos revisados com identificador, descrição, quantidade inteira e preço unitário em centavos. O total exato deve corresponder ao preço global publicado; itens não contêm custos internos. A versão anterior permanece imutável. Propostas históricas sem snapshot estruturado não são preenchidas por inferência. Esta fatia prepara o contrato e wrapper revogados, mas o fluxo legado não deve ser liberado em paralelo: ainda exige integração da interface, visualização obrigatória e proteção da decisão para que o Cliente aceite exatamente os itens apresentados, além de migração de exportação e histórico. Unidade fracionária e rateio de preço global dependem de contrato específico.
