# ADR-0121 — Rejeição auditável de linha em staging

## Estado

Proposta para E01-S178, sem aplicação nem homologação. Complementa ADRs 0093, 0096 e 0101.

## Decisão

Rejeição é decisão de conferência sobre linha identificada por lote e chave, com motivo, ator, horário e revisão. Não cria, altera ou remove cadastros oficiais. Comando exige `cadastro.aprovar`, Cliente derivado do lote, revisão esperada e requestId; serializa operação, grava evento imutável e incremento de revisão junto da auditoria. Uma segunda rejeição da mesma linha por outro request é conflito, não uma decisão duplicada. Leitura histórica exige autorização do mesmo Cliente.

Nenhum comando de aprovação ou incorporação é liberado nesta etapa. A arquitetura de incorporação precisa comprovar códigos e unicidade da S177, classificação, vínculo, hierarquia, dependências de pais, consistência transacional e compatibilidade das tabelas oficiais da S176. Rejeitar pai deve ser considerado explicitamente por futura incorporação. Não transformar seleção ou revisão preliminar em aprovação operacional.

## Gates

RPCs de decisão e histórico permanecem sem EXECUTE para papéis da aplicação até testes de banco/RLS, duas sessões e revogação concorrente, revisão de retenção e revisão adversarial. A recepção prévia também depende de resolver a janela de segurança entre migrations 0315 e 0320. Não aplicar ou habilitar em produção antes dos gates.
