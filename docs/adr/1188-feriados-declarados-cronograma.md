# ADR-1188 — Feriados declarados na exportação parcial

Status: preparação local, desativada e não homologada.

O operador poderá solicitar leitura de feriados declarados do Cliente e, opcionalmente, de contrato escolhido explicitamente. A leitura reutiliza a fotografia paginada da ADR-1019, mantém a indicação de fonte não oficial e não presume que o contrato escolhido pertence ao Plano. As datas ativas são somadas às informadas manualmente. Uma releitura integral depois da geração deve coincidir com a fotografia anterior; alteração observável cancela a entrega.

Flag específica de interface, permissões e gates do banco permanecem desligados. Conferência em duas leituras não é transação única: alterações revertidas entre leituras ou após a última leitura podem não ser detectadas. Não utilizar como prova de feriado oficial, cobertura completa, execução ou capacidade. Validar sessão, escopo, paginação, concorrência, equivalência entre datas, limites, autorização e revisão adversarial antes de habilitar.
