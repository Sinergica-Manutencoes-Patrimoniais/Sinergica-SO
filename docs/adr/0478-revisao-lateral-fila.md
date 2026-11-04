# ADR-0478 — revisão lateral de itens da fila

Status: proposto; não aplicado nem homologado. Um contador privado por item é incrementado por gatilho apenas enquanto o gate estiver ativo; a outbox e seus dados não são alterados. Cada mudança do gate renova época, invalidando prévias anteriores. Alterações anteriores à ativação ou ocorridas com gate fechado não são reconstruídas. A instalação acrescenta um gatilho à tabela e, mesmo desligado, uma leitura de gate; não é ausência total de impacto.

A ativação exige drenagem das transações que poderiam ver estado anterior, auditoria de todos os escritores (incluindo serviços privilegiados, triggers desabilitados e truncamento), verificação de locks/desempenho e testes concorrentes. Nenhuma ativação é autorizada aqui. A revisão não comprova estado remoto ou autorização futura e não habilita retry.
