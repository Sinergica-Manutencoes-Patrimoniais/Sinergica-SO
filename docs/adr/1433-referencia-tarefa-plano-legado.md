# ADR-1433 — Referência de tipo de tarefa do Plano legado

E01-S186: preservar de forma auditável o identificador do tipo de tarefa existente na origem, associado à Rotina e versão inicial criadas pelo mapeamento. A gravação exige confirmação da fotografia de origem e da revisão do rascunho, e mantém o identificador mesmo quando o tipo de tarefa está inativo. Repetição do mesmo pedido devolve o recibo; mudança da origem ou do destino exige nova conferência.

O registro é referência de migração: não é snapshot aprovado da Rotina, não atribui tipo à OS e não autoriza envio ao Auvo. Gate nasce fechado. Validar concorrência, preservação em cópias/versões, autorização, RLS/FORCE, rollback e revisão adversarial antes de ativar.
