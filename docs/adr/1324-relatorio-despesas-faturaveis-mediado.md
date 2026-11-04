# ADR-1324 — Mediação do relatório de despesas e faturáveis

Estado: preparação local; gate fechado, sem autorização de implantação.

A consulta existente é privada. Preparar mediador de leitura que verifica o ator esperado, o Cliente e ambas as capacidades (`despesa_visita.gerir` e `faturavel.efetivar`), sob trava compartilhada de autorização. O mediador também protege os gates existentes e o Cliente durante a consulta; o núcleo continua privado e responsável pelo período e pelas agregações. Nenhuma ação financeira, cobrança ou recebível é criada.

A interface só usará o mediador com flag específica, desligada por padrão. O novo gate inicia fechado e não substitui os gates existentes. Não se presume que todas as alterações das tabelas agregadas estejam bloqueadas: o relatório é leitura de um instante da transação, não prova de fechamento financeiro futuro.

Antes de habilitar, validar isolamento de Clientes, ambas as capacidades e suas revogações concorrentes, período, valores grandes, status cancelados, gates, RLS/FORCE e revisão adversarial. Rollback: desligar flag e gate, drenar consultas e só então remover a função e o gate após confirmar que não há consumidores; não modificar despesas, faturáveis ou histórico.
