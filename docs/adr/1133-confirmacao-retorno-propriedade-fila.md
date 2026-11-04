# ADR-1133 — Confirmação de retorno de propriedade da fila

Status: proposta local, não aplicada nem homologada.

O operador autorizado pode registrar que um Sistema ou Componente voltou ao Cliente de todas as observações históricas conhecidas do item da fila. A confirmação exige revisão do conflito, motivo, identidade atual e autorização, com recibo imutável e auditoria. O servidor trava o item e a origem, confere as observações conhecidas e recusa titularidades históricas divergentes. A repetição do mesmo pedido retorna o recibo apenas após nova checagem de acesso e propriedade atual.

A confirmação registra uma conferência pontual: não transfere histórico, corrige a propriedade, comprova a legitimidade da movimentação nem o resultado remoto, fecha alerta ou autoriza retry. Não resolve titularidades múltiplas. Gate e interface permanecem desligados. Validar ordem de locks, alterações de propriedade nas duas direções, todas as fontes históricas, replay, revogação, RLS/FORCE e revisão adversarial antes de ativar.
