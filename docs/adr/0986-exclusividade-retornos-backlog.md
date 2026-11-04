# ADR-0986 — Exclusividade entre retornos integral e parcial

Status: preparação privada, não homologada.

Os índices individuais das filas integral e parcial não impedem que a mesma Pendência tenha um retorno aguardando em cada tabela. Preparar registro interno com chave única por Pendência, atualizado por triggers transacionais das duas tabelas. Inserção de retorno aguardando reserva a Pendência; promoção libera somente a reserva correspondente. Identidade e dados de origem não podem ser modificados após inserção, e exclusão de retorno é recusada. O histórico continua nas próprias tabelas e eventos.

A migration reconstrói reservas para retornos aguardando existentes; conflito entre filas deve falhar atomicamente, sem apagar dados ou escolher vencedor. Não habilitar gates até inventariar registros existentes, reconciliar conflitos, revisar RLS/FORCE e privilégios do proprietário, ordens de locks de todos os escritores, rollback, concorrência, consumidores e revisão adversarial. A reserva não impede fontes não integradas, não prova parada remota e não substitui o ciclo ativo. Não aplicar em produção nesta etapa.
