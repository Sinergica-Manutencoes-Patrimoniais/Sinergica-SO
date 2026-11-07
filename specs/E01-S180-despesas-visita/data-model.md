# Data model — E01-S180

`pcm.despesas_visita`: id, visita_id obrigatório, cliente_id coerente com Visita, categoria_id, data, descricao, previsto_centavos >= 0, realizado_centavos nullable >= 0, status ativa/cancelada, request_id único, revision, created_by. `pcm.despesa_visita_rateios`: despesa_id + os_id únicos, valor_centavos >= 0, mesma Visita/Cliente, soma exata quando houver rateio. `pcm.despesa_visita_comprovantes`: despesa_id, storage_path privado, tipo/tamanho/hash e autor. Histórico append-only de alteração/cancelamento. Vínculo legado opcional único por auvo_id, sem tornar esse identificador obrigatório para novas despesas.

## Regras transversais

UUIDs e vínculos históricos preservados. Cliente sempre deriva do objeto oficial e é validado contra todas as referências. Estado é transição autorizada, não texto livre; revisão otimista para edição e lock na efetivação financeira. Valores em centavos inteiros; zero e ausência não são equivalentes. Nenhum custo privado em projeção de Cliente. Toda tabela nova usa FORCE RLS; eventos de auditoria append-only, inclusive para service_role. Índices por Cliente/status/data e paginação para listas; schema de domínio existente, sem inventar workspace_id onde não existe.

## Compatibilidade e migração

Prévia antes de gravar; IDs legados mantêm correspondência única e só são convertidos quando mapeados. Duas execuções não criam novos vínculos. Reversão lógica preserva fatos, documentos e decisões; não apagar histórico ou liberar cobrança retroativamente.

