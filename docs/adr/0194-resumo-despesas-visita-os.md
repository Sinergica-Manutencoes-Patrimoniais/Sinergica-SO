# ADR-0194 — Resumo de despesas da Visita e rateios por OS

**Estado:** preparação bloqueada, não homologada nem implantada.

Resumo da Visita considera cada despesa ativa uma vez: soma previsão e soma realizado em eixos separados, com contagem de realizados ainda desconhecidos. Não soma previsão a realizado como gasto. Despesa sem rateio fica explicitamente não atribuída; rateios com vínculo encerrado são contados como históricos e sinalizados, não tratados como cobertura vigente.

Resumo por OS agrega somente parcelas da última versão do rateio, sem multiplicar a despesa da Visita. Parcela de despesa não realizada é projeção, não gasto; parcela de despesa realizada é alocação do realizado. Rateio é único sobre o valor aplicável atual, portanto não inventar rateio do previsto quando já há realizado. Cancelados ficam fora dos totais. Totais acima do limite seguro do cliente são recusados em vez de arredondados. Consultas segregam Cliente/Visita e exigem autorização vigente; gate privado e RPCs ficam fechados.

Antes de ativar, integrar mudanças de vínculo de OS, verificar competências e relatórios por Cliente/técnico/período, volumes, concorrência, cancelamentos, arredondamento e autorização, executar testes integrados e revisão adversarial. Não cria lançamento, despesa, cobrança ou evento financeiro.
