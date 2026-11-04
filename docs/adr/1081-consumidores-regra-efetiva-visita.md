# ADR-1081 — Regra efetiva nos consumidores de ocorrência

Status: proposta local, não aplicada nem homologada.

## Decisão

A prévia de Visitas da Rotina e o comando de preparação de ocorrência devem consultar a regra efetiva resolvida pelo histórico da ADR-1080, em vez de pressupor que a regra de criação é sempre atual. Sem transições, a resolução retorna a regra histórica original e preserva o comportamento existente. A identidade da ocorrência continua ancorada na Visita e semana de origem; ocorrências existentes não são alteradas nem apagadas.

## Limites

Esta alteração não habilita mudança de dia, não reescreve ocorrências já criadas nem prova cobertura de todos os consumidores. Identificar como tratar ocorrências existentes e feriados antes de gravar transições. Verificar concorrência, validade de versões e garantias de autorização/RLS, consistência da fotografia, compatibilidade dos demais consumidores e revisão adversarial. Nenhuma migration deve ser aplicada em produção por esta decisão.
