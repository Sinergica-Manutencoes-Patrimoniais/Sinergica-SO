# ADR-1656 — Preparação unitária de vencimentos antigos

## Decisão

Permitir que o PCM solicite explicitamente a preparação de um ciclo de calendário vencido mesmo quando o vencimento tenha mais de 366 dias. O pedido continua individual, sujeito ao gate existente, à autorização, ao snapshot e vigência, à identidade canônica e às demais guardas do materializador. O limite de 366 dias permanece na extensão de cada janela de consulta, permitindo percorrer períodos históricos em janelas menores.

Esta decisão substitui apenas o limite de idade do ADR-1348. Não comprova ausência de execução, não altera a âncora, não gera retroativos em massa nem cria OS ou tarefa externa. Versões inelegíveis e fontes inconsistentes continuam bloqueadas.

## Validação pendente

Antes de habilitar, validar datas-limite, autorização, versão, recorrência, isolamento, concorrência e repetição, além da jornada de consulta por períodos antigos. Nenhum gate é ativado por esta alteração. A interface atualizada deve acompanhar a migration; com banco anterior, pedidos acima do limite antigo continuarão rejeitados.
