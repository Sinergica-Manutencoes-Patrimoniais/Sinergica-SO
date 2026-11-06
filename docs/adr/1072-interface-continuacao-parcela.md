# ADR-1072 — Conferência da continuidade de parcela

**Status:** preparação não homologada. Complementa ADR-1071.

A interface consulta proposta pendente, parcela atribuída, revisão e fotografia da OS anterior, exibe descrição e minutos restantes e exige confirmação antes de pedir nova OS. Request e IDs são preservados na sessão para repetição idêntica. A consulta é informativa; o comando revalida dados, capacidades, origem e vínculos na transação.

Concessões apenas para authenticated, com gates existentes fechados e flag de tela desligada. Enquanto ativada a nova interface, o formulário não cria novas aprovações pelo caminho legado; tentativas anteriores permanecem sujeitas a reconciliação. Não comprova parada, execução ou ausência de fontes de escopo, nem envia Auvo. Testar concorrência, segurança, acessibilidade, reapresentação de pedido, integração de cobertura/capacidade e revisão adversarial antes de habilitar.
