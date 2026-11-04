# ADR-1103 — Consulta de conflito de propriedade de OS

Status: proposta local, não aplicada nem homologada.

## Decisão

Exibir ao operador autorizado do Cliente atual apenas a existência do conflito, a OS, a revisão e se a propriedade ainda diverge da observação anterior. Não divulgar o identificador do Cliente anterior nem o histórico de outro Cliente. A consulta não transfere registros nem resolve o conflito; retorno ao Cliente observado é apenas um estado local a conferir.

## Limites

Listagem é paginada e não constitui fotografia, pois a OS pode mudar de Cliente. Verificar revogação, transferência concorrente, RLS/FORCE, privacidade e revisão adversarial; conceder acesso e ativar gates somente de forma coordenada após validação.
