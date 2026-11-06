# ADR-1117 — Geração ou supressão de semana contratual

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar entrada transacional que decide entre gerar Visita contratual e registrar supressão para feriado declarado na data da regra vigente. A decisão e o recibo idempotente pertencem ao mesmo pedido; repetição devolve a decisão original mesmo que o feriado tenha mudado depois. Reutilizar comandos existentes, inclusive suas validações de semana, regra, autorização e concorrência. Empate entre feriados usa o menor UUID para escolha determinística, sem atribuir prioridade de negócio.

## Limites

Não reconcilia Visitas ou ocorrências já existentes nem muda regra contratual. Se houver conflito, a transação falha integralmente. A função não envia tarefa Auvo; o núcleo gerador e todos os triggers ainda exigem inventário. Gate permanece fechado e função privada até integração, provas de retry, transação, concorrência, auditoria, isolamento, revisão adversarial e homologação.
