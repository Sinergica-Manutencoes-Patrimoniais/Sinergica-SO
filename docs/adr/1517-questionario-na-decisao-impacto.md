# ADR-1517 — Conteúdo do questionário na decisão de impacto

## Contexto

A comparação anterior registrava apenas o ID do questionário. A fonte pode mudar mantendo o mesmo ID e a decisão continuaria parecendo atual, inclusive na aprovação.

## Decisão

Ampliar a comparação existente com situação e impressões SHA-256 do JSON integral histórico e da fonte atual, sem enviar conteúdo bruto adicional. A interface informa o estado, inclusive histórico ou fonte indeterminados. Ao registrar decisão, bloquear escritas concorrentes no cadastro de questionários; antes do token de aprovação, quando o gate existente de decisão comparada estiver ativo, revalidar cada decisão vigente contra a comparação atual, mantendo bloqueio e exigindo nova conferência se ausente ou divergente. Não criar gate adicional e não alterar a guarda 1045.

## Compatibilidade e limites

Clientes antigos que exigem esquema exato precisam atualizar junto do servidor; tentativas já guardadas continuam legíveis e replays reconhecidos, mas fotografias antigas não provam o novo conteúdo e exigem nova decisão antes de aprovação sob o gate existente. Hash inclui metadados; mudança não implica automaticamente mudança técnica. Histórico incompleto e fontes externas seguem indeterminados. Validar concorrência, desempenho e revisão adversarial antes de ativação; não autoriza deploy ou Auvo.
