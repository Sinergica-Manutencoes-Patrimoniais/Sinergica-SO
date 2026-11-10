---
name: "docs-adr-0272-proposta-reprocessamento-cronograma-md"
description: "Documento Sinérgica SO: ADR-0272 — Proposta de reprocessamento de Rotina importada"
alwaysApply: false
---

# ADR-0272 — Proposta de reprocessamento de Rotina importada

Status: proposta, não homologada.

Para identidade já vinculada, registra-se proposta imutável com linha, aprovação atual, versão e revisão do Plano, fotografia dos campos atuais da Rotina e valores propostos do mapeamento, incluindo tolerância declarada ou zero. Não se atualiza a Rotina nem se interpreta equivalência pela posição. Somente uma Rotina ainda em versão rascunho do Plano rascunho é elegível. Identidade declarada não prova equivalência; PCM deve conferir antes de eventual aplicação. A incorporação futura deverá revalidar ambas revisões, identidade, dados e alvo, preservando campos sem representação no staging e o histórico de alterações.

Gate de incorporação e EXECUTE permanecem fechados; não há comando de aplicação nesta decisão e nenhuma OS é gerada. Exige revisão adversarial e testes antes da ativação.
