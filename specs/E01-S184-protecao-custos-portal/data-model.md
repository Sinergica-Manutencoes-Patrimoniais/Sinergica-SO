# Data model — E01-S184

Manter `comercial.proposta_versoes.payload` privado append-only. Publicar projeção allowlist por proposta_id + versao: tipo, escopo/descrição autorizada, preco_venda_centavos, valido_ate, status público e itens com descrição/quantidade/preço de venda quando explicitamente definidos. Excluir custo_total, custo_unitario, total interno de composição, margem, piso, fator, fornecedor, nota e observações internas. Público derivado da versão, nunca dados ao vivo. Arquivos têm audiência explícita e original privado. Mapa de remediação registra objeto/versão/arquivo antigo, ação, autor, data e hash; sem expor referência privada ao Cliente.

## Regras transversais

UUIDs e vínculos históricos preservados. Cliente sempre deriva do objeto oficial e é validado contra todas as referências. Estado é transição autorizada, não texto livre; revisão otimista para edição e lock na efetivação financeira. Valores em centavos inteiros; zero e ausência não são equivalentes. Nenhum custo privado em projeção de Cliente. Toda tabela nova usa FORCE RLS; eventos de auditoria append-only, inclusive para service_role. Índices por Cliente/status/data e paginação para listas; schema de domínio existente, sem inventar workspace_id onde não existe.

## Compatibilidade e migração

Prévia antes de gravar; IDs legados mantêm correspondência única e só são convertidos quando mapeados. Duas execuções não criam novos vínculos. Reversão lógica preserva fatos, documentos e decisões; não apagar histórico ou liberar cobrança retroativamente.

