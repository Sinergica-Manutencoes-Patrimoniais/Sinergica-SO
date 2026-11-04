# ADR-1495 — PMOC sem vínculo na data do ciclo

## Contexto
A declaração de origem Plano e a ausência de vínculo por Rotina não demonstram que um agendamento PMOC do Cliente, na mesma data, trate de obrigação diferente. O inventário já permite ao PCM classificar cada agendamento por versão em revisão.

## Decisão
Na consulta de origem do ciclo, sob o gate da materialização, verificar os agendamentos PMOC ativos do Cliente com a mesma data. Só considerar resolvido o agendamento com classificação vigente e fotografia atual da versão aprovada, se classificado como não relacionado ao Plano, ou relacionado a outro alvo/Rotina mediante vínculo válido dessa versão. Sem prova exigir revisão, impedindo geração individual e em lote no servidor. A classificação é declaração humana; não equivale à prova de fonte externa. Agendamento cancelado não é obrigação ativa, mas vínculos históricos continuam cobertos pela guarda própria. As tabelas de origem e classificações permanecem travadas até o fim da transação; não alterar agendamentos, OS ou tarefas.

## Limites
A classificação para a versão vigente também é preparada pela ADR-1496; não habilitar até esse fluxo, cobertura de fontes, fuso, testes de concorrência e revisão adversarial. Uma classificação para o Plano não decide equivalência de fontes externas. Guarda 1045, homologação e deploy seguem bloqueados.
