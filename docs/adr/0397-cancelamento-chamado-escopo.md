# ADR-0397 — Cancelamento conservador de Chamado

Status: proposta, não homologada.

O comando preparado registra cancelamento explícito com motivo, revisão, autorização e evento legado, sem modificar parcelas, OS ou Auvo. Para não perder escopo, permite apenas composição declarada completa com ao menos uma parcela e todas atendidas por OS finalizada válida; continuidade pendente ou executada sem OS finalizada e qualquer OS ativa impedem cancelamento. Chamado encerrado ou previamente cancelado também é bloqueado.

O caso com parcelas não resolvidas continua bloqueado: a devolução segura ao Backlog E01-S174 ainda não está comprovada e não pode ser inferida. Status legado e os demais escritores precisam de integração, locks e revisão adversarial. Gate e EXECUTE fechados; testes antes da ativação.
