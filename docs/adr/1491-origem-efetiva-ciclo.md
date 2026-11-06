# ADR-1491 — Consulta da origem efetiva antes de preparar ciclo

## Contexto
A decisão de origem e os vínculos PMOC já são registrados, mas o botão de preparar ciclo por calendário não os apresenta. Para origem PMOC, a tentativa de gerar no Plano falhava sem indicar o agendamento associado.

## Decisão
Preparar consulta autorizada por Plano, versão, Rotina e vencimento que distingue origem Plano, PMOC vinculado, PMOC pendente, vínculo obsoleto, origem ausente e conflito observado. Exigir mesmo ciclo previsto, conferir autorização e dados do vínculo; usos de versões posteriores precisam estar registrados na revisão. Interface sob flag exibe estado e só oferece preparação nova para origem Plano. Uma tentativa anterior permanece disponível para repetição idempotente, inclusive após mudança do estado. O servidor continua aplicando suas guardas no comando.

## Limites
Agendamentos PMOC não vinculados não são identificados por essa consulta; origem Plano não comprova exclusividade global. A consulta não altera PMOC, cria OS ou aciona Auvo. Testar revogação, replay, concorrência, múltiplos vínculos, versões e datas antes de ativar; homologação permanece bloqueada.
