# ADR-1126 — Visita suprimida fora da agenda operacional

Status: proposta local, não aplicada nem homologada.

Associar explicitamente a Visita preexistente ao registro imutável de supressão e excluí-la da lista operacional de Visitas, independentemente de eventual revogação posterior da supressão. Isso impede apresentar o cancelamento técnico como Visita regular ou cancelamento operacional; o histórico continua acessível pelos caminhos auditados próprios.

A lista de Visitas não cobre todos os indicadores, telas e consultas diretas. Antes de ativar, inventariar e adaptar todos os consumidores, provar associação, isolamento, paginação, consultas históricas, RLS, concorrência e revisão adversarial. O recurso segue fechado e não autoriza apagar dados.
