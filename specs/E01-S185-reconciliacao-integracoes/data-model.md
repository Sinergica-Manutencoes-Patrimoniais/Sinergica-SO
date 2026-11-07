# Modelo de dados — E01-S185

Modelo lógico planejado; nomes físicos finais seguem `docs/planejamento/plano-manutencao/contratos-programa.md` e ADR-0026/0027/0028.

Ocorrência de reconciliação: UUID, integração, tipo/id objeto, Cliente, versão, causa/código, estado desejado/observado minimizado, status, última tentativa/sync, ação permitida e correlationId. Tentativa append-only: requestId, responsável/job, início/fim, resultado e evidência_ref. Restrição única por objeto/causa/versão; resolução não apaga histórico. Projeção de leitura aplica escopo/permissão do objeto e omite custo/margem/credenciais. Versão da fonte muda invalidando ação antiga.

## Invariantes

RequestId único, expectedRevision obrigatório em decisão concorrente; UUID interno preservado. Referências devem pertencer ao mesmo Cliente. Tentativas/eventos/decisões conservam origem, ator, instante e resultado; histórico append-only. Payload minimizado e evidência privada com acesso por escopo. SQL novo será aditivo, RLS FORCE em todas as tabelas e testes permitido/negado. Não editar migrations aplicadas nem apagar dado para reconciliar conflito.
