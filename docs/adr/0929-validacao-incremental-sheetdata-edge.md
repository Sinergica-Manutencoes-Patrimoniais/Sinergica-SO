# ADR-0929 — Validação incremental de linhas XLSX no Edge experimental

## Contexto

Uma aba sintética de 3,6 MiB com 900 mil elementos desconhecidos dentro de `sheetData` esgotou a memória do worker local ao ser convertida em DOM. O leitor anterior ignorava filhos que não fossem `row`, embora `sheetData` de uma planilha OOXML contenha linhas.

## Decisão

Antes de criar o DOM no processador Edge experimental, percorrer XML com SAX e rejeitar imediatamente filhos diretos de `sheetData` que não sejam elementos `row` do namespace de planilha. Usar `saxes` 6.0.0 fixado e manipular namespaces, comentários, CDATA e fechamento pelo parser, sem heurística de texto ou redução do limite de células. As regras existentes de tamanho, entidades, CRC e leitura permanecem. O parser é aplicado no processador direto experimental; a rota operacional e seus gates permanecem fechados conforme ADR-0919.

## Limites e compatibilidade

Essa validação rejeita estruturas inválidas, mas não impede que muitos elementos `row` ou outros elementos válidos consumam memória no DOM. Não prova limite de memória, execução em plataforma hospedada, nem compatibilidade com todos os produtores XLSX; requer testes com fontes reais e casos adversariais, medições, parser incremental completo ou isolamento comprovado, e revisão adversarial. Não afirmar que S169 está pronta ou habilitar importação.

## Reversão

Reverter somente a validação experimental por entrega coordenada preservando a desativação da rota. Nenhum dado ou permissão é alterado.
