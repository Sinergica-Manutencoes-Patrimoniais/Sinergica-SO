# ADR-1486 — Resolver impacto pela retirada futura da ocorrência

## Contexto
A decisão `exige_reconciliacao` bloqueia aprovação indefinidamente. A especificação permite retirar escopo futuro, preservando histórico e sem cancelar OS. Não se deve reinterpretar isso como decisão de manter.

## Decisão
Preparar resolução auditada e idempotente `retirar_geracao`, vinculada à última decisão de impacto e revisão do Plano, com motivo. Quando a revisão for aprovada na mesma transação, registrar retirada imutável apenas para ocorrências cujo vencimento seja igual ou posterior à vigência; para vencimento anterior exigir outra decisão PCM. A avaliação deixa de contar como pendente somente a decisão específica resolvida; decisão posterior exige nova conferência. As guardas de continuidade impedem novos vínculos, fila e Chamados para ocorrência sem selo de manutenção. OS e Chamados existentes não são cancelados ou editados. Se a nova regra gerar a mesma identidade e data, exige reconciliação; não criar duplicata.

## Limites
A resolução não demonstra cobertura integral das fontes e não autoriza aprovação por si só. Outros consumidores devem ser inventariados. Testar revisão posterior, ocorrências anteriores à vigência, OS existentes, autorização, replay e concorrência nas duas ordens, bem como revisão adversarial antes de habilitar. Nenhum deploy/Auvo.
