# ADR-1069 — Seleção de parcela para nova OS

**Status:** preparação não homologada. Complementa ADR-1068.

Consulta paginada mostra somente parcelas diretas pendentes e não atribuídas, com as revisões do Chamado e da composição. A interface exige escolha e motivo, fotografia de escopo, pedido persistido e confirmação da OS em solicitação, sem técnico ou agendamento. O servidor revalida toda a seleção e cria/atribui em transação; resposta perdida deve repetir a mesma operação.

Gates existentes e novo gate de criação permanecem fechados; flag de interface desligada. A consulta é uma fotografia por página, não garante estabilidade entre páginas ou ausência de outros escritores. Validar autorização, revogação, paginação, concorrência, mudanças da parcela, compatibilidade da conversão e triggers, isolamento e revisão adversarial antes de habilitar. Parcelas de Backlog e continuidade não são contempladas.
