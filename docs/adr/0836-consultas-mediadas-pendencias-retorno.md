# ADR-0836 — Consultas mediadas para preparação de Pendências

## Contexto

A tela de preparação usa consultas privadas de condição estrutural e decisão de validação. O comando mediado da ADR-0835 não supre essas leituras e não deve conceder acesso direto aos núcleos.

## Decisão

Criar wrappers para condições, decisões e lista de Pendências existentes, sob o mesmo gate fechado da ADR-0835. Cada wrapper exige `READ COMMITTED`, trava de autorização compartilhada até o fim da transação e capacidade atual `execucao.validar` por Cliente. Os núcleos mantêm os próprios gates quando existentes, autorização, filtros e paginação; suas ACLs não mudam. Somente `authenticated` executa os wrappers, sem acesso direto às tabelas.

A consulta privada de condições é corrigida aditivamente: nomes de colunas `id` são qualificados para não conflitar com a coluna de saída de mesmo nome. O teste integrado reproduziu o erro antes da correção.

## Limites

Leitura mediada não valida integridade do retorno nem substitui aprovação PCM. Sessões, autorização externa, concorrência de origem e jornada integrada completa continuam sujeitos a testes e revisão adversarial. Nenhum gate é aberto por esta decisão.
