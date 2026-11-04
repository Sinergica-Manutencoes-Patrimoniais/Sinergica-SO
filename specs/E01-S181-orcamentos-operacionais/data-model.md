# Data model — E01-S181

Evoluir `comercial.propostas` e `comercial.proposta_versoes` aditivamente: vínculo operacional com cliente_id, os_id, lista_id e origem; modelar oportunidade existente quando houver ou origem operacional explícita (não criar oportunidade fictícia silenciosa). Snapshot privado imutável contém custos; público tem allowlist independente. Decisão referencia proposta_id + versao, autor/data/canal/motivo. Dispensa com regra/motivo e responsável, sem transformar venda em gratuidade. Complemento aponta proposta/versão anterior. Correspondência legado `(schema, id_legado)` única para proposta canônica quando convertido, sem copiar decisões como novas. Manter pcm.orcamentos_servico legível e compatível; proibir novas emissões operacionais pelo modelo antigo após corte.

## Regras transversais

UUIDs e vínculos históricos preservados. Cliente sempre deriva do objeto oficial e é validado contra todas as referências. Estado é transição autorizada, não texto livre; revisão otimista para edição e lock na efetivação financeira. Valores em centavos inteiros; zero e ausência não são equivalentes. Nenhum custo privado em projeção de Cliente. Toda tabela nova usa FORCE RLS; eventos de auditoria append-only, inclusive para service_role. Índices por Cliente/status/data e paginação para listas; schema de domínio existente, sem inventar workspace_id onde não existe.

## Compatibilidade e migração

Prévia antes de gravar; IDs legados mantêm correspondência única e só são convertidos quando mapeados. Duas execuções não criam novos vínculos. Reversão lógica preserva fatos, documentos e decisões; não apagar histórico ou liberar cobrança retroativamente.

