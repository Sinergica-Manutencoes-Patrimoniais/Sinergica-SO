# ADR-1097 — Histórico das observações internas

Status: proposta local, não aplicada nem homologada.

## Decisão

Preparar consulta paginada do histórico local de uma proposta ou faturável que ainda tenha vínculo e Cliente comprováveis. A leitura exige capacidade de reconciliação e capacidade do domínio de origem; não retorna valores, dados financeiros sensíveis ou payloads. Uma observação não é confirmação remota ou decisão de negócio.

## Limites

Os vínculos precisam ser revalidados no acesso, inclusive após transferência. Sem vínculo íntegro, a consulta falha fechada e requer reconciliação própria. Testar autorização, RLS/FORCE, revogação concorrente, paginação, transferência, privacidade e revisão adversarial antes da concessão e ativação.
