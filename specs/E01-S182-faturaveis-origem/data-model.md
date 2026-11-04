# Data model — E01-S182

`financeiro.itens_faturaveis`: id, cliente_id, origem_tipo, origem_id, identidade_complemento nullable, item_base_id nullable, valor_original_centavos >= 0, valor_conferido_centavos >= 0, competencia, status pendente/conferido/parcial/faturado/cancelado/estornado, revision, request_id único. Índice único de origem base e de complemento explícito. `financeiro.faturavel_documentos`: item_id, documento_ref, data, valor_centavos > 0, lancamento_id opcional, request_id único; saldo >= 0 sob lock transacional. Eventos append-only para conferência/cancelamento/estorno. Estorno vincula alocação original; sem delete de lançamentos históricos.

## Regras transversais

UUIDs e vínculos históricos preservados. Cliente sempre deriva do objeto oficial e é validado contra todas as referências. Estado é transição autorizada, não texto livre; revisão otimista para edição e lock na efetivação financeira. Valores em centavos inteiros; zero e ausência não são equivalentes. Nenhum custo privado em projeção de Cliente. Toda tabela nova usa FORCE RLS; eventos de auditoria append-only, inclusive para service_role. Índices por Cliente/status/data e paginação para listas; schema de domínio existente, sem inventar workspace_id onde não existe.

## Compatibilidade e migração

Prévia antes de gravar; IDs legados mantêm correspondência única e só são convertidos quando mapeados. Duas execuções não criam novos vínculos. Reversão lógica preserva fatos, documentos e decisões; não apagar histórico ou liberar cobrança retroativamente.

