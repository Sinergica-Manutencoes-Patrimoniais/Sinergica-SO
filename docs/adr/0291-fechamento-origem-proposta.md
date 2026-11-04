# ADR-0291 — Serialização de origem e fechamento

Status: proposta; gates e funções fechados, validação pendente.

O reconhecimento da proposta usa wrapper que toma `SHARE` na tabela de fechamento antes de delegar ao comando da ADR-0286. O fechamento legado grava essa tabela e requer lock incompatível, tornando a verificação de competência e a criação do candidato uma transação ordenada contra fechamento/reabertura. O comando interno continua revogado para papéis de aplicação; o wrapper também nasce revogado e a flag permanece desligada. Essa estratégia replica os locks de S182 já existentes, é global entre competências e pode reduzir concorrência. Não altera fechamento legado nem protege acessos privilegiados que ignorem o wrapper; exige testes de duas sessões, ordem de locks e permissões antes da ativação.
