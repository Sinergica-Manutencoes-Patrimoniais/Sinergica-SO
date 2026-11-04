# ADR-1068 — Criação de OS com parcela direta do Chamado

**Status:** preparação privada, não homologada. Complementa ADR-1046 e ADR-0968.

Uma operação transacional cria OS para uma parcela direta e registra a atribuição exclusiva, reutilizando os comandos de conversão e atribuição existentes. A fotografia do escopo, revisão do Chamado, revisão da composição e descrição da parcela são conferidas; a descrição da OS passa a ser a da parcela, enquanto a necessidade integral permanece no Chamado. A OS nasce em solicitação, sem agendamento ou envio Auvo. Falha na criação, ajuste ou atribuição reverte toda a transação; o recibo do pedido permite repetição idêntica.

Somente parcelas sem origem Backlog usam esta operação. Não comprova execução, não implementa continuidade ou fechamento e não aceita status de planejamento. Gate próprio e funções existentes ficam fechados; função sem EXECUTE operacional. Antes de habilitar, revisar todos os triggers de OS e chamadas externas, exclusividade com escritores legados, concorrência de escopo, locks, status, propriedade/FORCE RLS, replay e revisão adversarial. Não executar tarefas Auvo ou aplicar em ambiente oficial sem autorização.
