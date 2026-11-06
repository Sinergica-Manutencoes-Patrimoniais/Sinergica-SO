# ADR-0341 — Congelamento de contratos de perguntas na aprovação

Status: proposta, não homologada.

Somente com gate específico habilitado, a transição de versão rascunho para aprovada exige que cada pergunta de cada questionário presente no snapshot tenha uma única identidade e contrato PCM atual da mesma versão/Rotina/questionário, com pergunta-fonte idêntica à congelada. Contratos são anexados ao novo snapshot no momento da transição, antes de se tornar imutável; versões já aprovadas não são alteradas. Rotinas sem questionário não recebem regra inventada. Texto e foto não são inferidos como obrigatórios.

Na falta de contrato ou com fonte alterada a aprovação falha integralmente enquanto o gate estiver ligado. Com gate desligado, comportamento legado não muda e nenhuma completude é afirmada. Copiar contratos para novas revisões, leitura da regra pelo retorno e migração de versões históricas requerem trabalho e revisão separados. Gate nasce fechado; testes de concorrência/snapshot e revisão adversarial obrigatórios antes da ativação.
