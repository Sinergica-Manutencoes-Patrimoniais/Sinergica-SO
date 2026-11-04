# ADR-0506 — Identidade de ciclo entre versões

Status: preparado, gate fechado, não aplicado nem homologado. Uma série canônica por Plano, identidade lógica da Rotina, alvo, âncora e regra congelada agrupa o índice de ciclo; versões com esses elementos idênticos e mesmo índice compartilham identidade, sem deduplicar somente por data. A verificação usa snapshot aprovado e cálculo canônico, com chaves únicas e idempotência.

Alteração de âncora/regra/alvo cria série distinta: continuidade ou deduplicação entre séries diferentes não é inferida. A tabela legada de ocorrências preparadas 0337 ainda possui unicidade por data e precisa reconciliação/migração antes de esta identidade orientar materialização; ponte Visita exige modelo próprio. Não cria ocorrências ou OS e não substitui o fluxo operacional. Testes, concorrência e revisão adversarial pendentes.
