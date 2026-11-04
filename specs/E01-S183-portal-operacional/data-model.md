# Data model — E01-S183

Reusar clientes/contatos existentes e vínculo autorizado à Conta; complementar membership ativa/revogada e permissões por ação conforme E01-S170. Disponibilidade liga lista_id + contato_id + status informado + observacao + timestamp em histórico. Consultas de orçamento/OS/cobrança são projeções, não cópias concorrentes. Decisão referencia versão canônica. Arquivos distinguem audiência cliente/interna e autorização no download.

## Regras transversais

UUIDs e vínculos históricos preservados. Cliente sempre deriva do objeto oficial e é validado contra todas as referências. Estado é transição autorizada, não texto livre; revisão otimista para edição e lock na efetivação financeira. Valores em centavos inteiros; zero e ausência não são equivalentes. Nenhum custo privado em projeção de Cliente. Toda tabela nova usa FORCE RLS; eventos de auditoria append-only, inclusive para service_role. Índices por Cliente/status/data e paginação para listas; schema de domínio existente, sem inventar workspace_id onde não existe.

## Compatibilidade e migração

Prévia antes de gravar; IDs legados mantêm correspondência única e só são convertidos quando mapeados. Duas execuções não criam novos vínculos. Reversão lógica preserva fatos, documentos e decisões; não apagar histórico ou liberar cobrança retroativamente.

