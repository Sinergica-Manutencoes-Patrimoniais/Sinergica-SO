# ADR-1153 — Consulta de exceções para intenção de Visita

Status: proposta local, não aplicada nem homologada.

Expor à interface de Visita a consulta paginada de exceções da mesma OS por entrada mediada, exigindo gate próprio, capacidade de Visita e capacidade de materiais do Cliente. A consulta retorna histórico, não confirma se a exceção continua aberta. Conceder execução autenticada à consulta e ao comando da ADR-1152 sem abrir o gate. A interface guarda a origem escolhida no pedido para que o retry não mude de protocolo com alteração de flag.

Faltam prova de autorização sob revogação, lock global dos escritores, paginação concorrente, recuperação, acessibilidade e revisão adversarial. A concessão não substitui gates, integração operacional ou teste e não autoriza reprogramar OS ou tarefa remota.
