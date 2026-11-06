# ADR-1531 — Aplicação explícita de retiradas efetivas à fila

## Contexto
Uma retirada aprovada impede novos vínculos ou Chamados da ocorrência, porém uma entrada já existente pode continuar marcada como aguardando. Consultar a fila não deve executar escrita silenciosa.

## Decisão
Oferecer comando explícito e idempotente do PCM para aplicar retiradas já aprovadas e efetivas à fila local do Plano, em lote limitado. Conferir Cliente, capacidade, vigência civil, versão única na data da ocorrência, selo de retirada e fonte atual sob travas. Somente entrada aguardando cuja fonte vinculada continue comprovadamente candidata, sem Chamado, OS, Grupo ou intenção observados, passa a cancelada na fila; registrar ator, motivo derivado da resolução, revisão e auditoria. Casos com execução ou fonte incerta ficam intactos para conferência. Visitas exigem também `visita.confirmar`. A consulta da fila não executa o comando.

## Consequências
A ação não altera ocorrência, Chamado, OS ou Auvo, e preserva histórico. Não antecipa vigência futura nem define tratamento de datas distintas. Pedidos incertos podem ser repetidos com o mesmo ID; entradas não elegíveis não são deduzidas como executadas ou canceladas. A aplicação depende de ação explícita do PCM, não de job automático. Permanecem guarda 1045 e gates existentes, com necessidade de revisão adversarial e teste de concorrência antes de habilitar.
