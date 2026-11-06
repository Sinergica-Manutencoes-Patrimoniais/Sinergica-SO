# ADR-0788: projeção semanal parcial de ocorrências sem OS

Status: proposta sob gates fechados, não homologada.

## Contexto e decisão

Os vínculos das fontes S166 permitem identificar algumas ocorrências calendário e por Visita, mas as preparadas não comprovam estado de execução. Uma projeção paginada por Cliente retorna candidatas por semana de vencimento original, separadas por tipo, com a última declaração explícita de HH para ocorrências calendário quando houver. A ausência de uma OS identificada não prova que não exista trabalho externo ou execução; todos os itens permanecem incompletos e não compõem saldo.

São omitidas da faixa de ocorrências sem OS as que possuem qualquer vínculo identificável com OS, inclusive ponte legada ou vínculo de Grupo Quantitativo, independentemente do status da OS. A inclusão de ocorrência por Visita sem estimativa é explícita e não infere HH. A função exige `capacidade.gerir` e `plano.gerir`, respeita gates da fila preparada e da fonte de esforço e concede somente leitura mediada. Não altera vínculo, histórico ou execução.

Páginas diferentes ou consultas separadas de Visita e ocorrência não representam snapshot único. Assim, os subtotais são apresentados separadamente, nunca somados entre si como demanda total; execução, reprogramação, ausência de vínculos não cobertos, outros Clientes e paginação permanecem por validar. Antes de consolidar saldo, é necessário snapshot transacional combinado e cobertura confiável de estados e origens; revisão adversarial e homologação seguem obrigatórias.
