# ADR-1086 — Consulta do histórico de observação de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Permitir consulta paginada das observações locais de uma OS mediante sessão, capacidade de reconciliação e posse atual da OS pelo Cliente. As páginas retornam revisão, estado local, sinal de existência de tarefa, estado de sincronização e horários; não retornam o identificador remoto ou payload. O histórico é declarativo e não confirma resultado remoto nem resolve divergência.

## Limites

Permissões e gates devem ser revalidados no servidor; acesso continua privado até concessão coordenada. Transferência de OS entre Clientes exige reconciliação auditada e é recusada enquanto o registro pertencer ao Cliente anterior. Testar paginação concorrente, revogação, isolamento, retenção, FORCE RLS, privacy e revisão adversarial antes da liberação.
