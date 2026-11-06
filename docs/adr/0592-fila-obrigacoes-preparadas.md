# ADR-0592 — Consulta de obrigações preparadas

Consulta paginada por Plano reúne ocorrências preparadas de calendário e de Visita e sinaliza registros aditivos de Grupo sem duplicar a mesma origem. O cursor usa tipo e identidade da ocorrência; a autorização é conferida por Cliente e Plano. O gate inicia desligado e nenhuma permissão é concedida.

A listagem não é fila de execução, não verifica estado de OS ou da fila legada e não cria, altera ou dispara tarefas. Uma ocorrência não Grupo pode ter efeitos externos não refletidos nela; o estado exibido não significa que nunca houve execução. Revisão e testes seguem pendentes.
