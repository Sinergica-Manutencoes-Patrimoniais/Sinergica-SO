# ADR-1521 — Janela multirrotina com origem conferida

## Contexto
O Plano pode conter várias Rotinas, mas o comando de geração existente prepara uma Rotina por vez. A prévia consulta a origem; se o gate de origem for desligado antes do comando, o núcleo antigo deixa de exigir essa proteção.

## Decisão
A jornada do Plano permite selecionar até 25 Rotinas por calendário para a mesma janela. Consulta e apresenta ciclos e origem por Rotina; qualquer origem diferente de Plano impede iniciar. Após confirmação explícita, executa uma transação por Rotina, com progresso, recibos e retomada idempotente. Uma falha não desfaz Rotinas já concluídas. O servidor continua validando janela civil, vencidos, revisão e conjunto esperado.

Um novo wrapper exige e bloqueia em leitura o gate de origem existente durante cada transação e delega ao comando de lote conferido. Não há gate novo ou alteração do comportamento dos comandos anteriores. O wrapper valida ator e Cliente e não cria OS ou tarefas Auvo. Cada ocorrência retornada pode ser conferida individualmente na fila, sem inclusão automática.

## Limites
A conferência PMOC é a do núcleo existente e não prova exclusividade de fontes externas. Não ligar flags, homologar ou publicar sem testes integrados, fontes/fuso, concorrência, compatibilidade e revisão adversarial. O lote não é atômico entre Rotinas; armazenamento por sessão não é coordenação entre abas.
