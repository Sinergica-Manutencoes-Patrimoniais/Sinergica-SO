# ADR-1045 — Proveniência do pedido de promoção atômica

**Status:** preparação privada, não homologada. Complementa ADR-1044.

A retentativa da promoção atômica não pode apresentar duas operações anteriores independentes como se tivessem sido executadas juntas. Registrar os dois IDs e o retorno em tabela privada, imutável, na mesma transação dos dois comandos. A entrada somente aceita repetição com os dois IDs, ator, Cliente e retorno idênticos; se não houver registro próprio, recusa pedidos ou retorno já utilizados nos comandos individuais. Serializar os IDs pelos mesmos advisory locks dos comandos existentes. As validações, recibos, auditoria, gates e autorizações continuam no núcleo.

O mediador verifica sessão, capacidades e gates antes de consultar proveniência e permanece privado. A retenção desse registro é permanente e não é comprovante de execução ou parada. Antes de conceder acesso, validar com duas sessões as interações com comandos individuais, gate, revogação, deadlock, rollback, replay e todas as demais fontes de escrita; executar pgTAP e revisão adversarial. Não ativar ou implantar com base nesta preparação.
