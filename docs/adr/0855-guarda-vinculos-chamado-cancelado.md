---
name: "docs-adr-0855-guarda-vinculos-chamado-cancelado-md"
description: "Documento Sinérgica SO: ADR 0855 — Guarda opt-in de vínculos após cancelamento"
alwaysApply: false
---

# ADR 0855 — Guarda opt-in de vínculos após cancelamento

O cancelamento conservador bloqueia Chamado e suas OS ao decidir, mas os triggers legados 1028 verificam somente `sso_encerrado_em`: um escritor posterior pode adicionar ou alterar vínculo de Chamado cancelado. A proteção complementar fica desligada por padrão e não substitui a 1028.

Com gate privado habilitado, os triggers bloqueiam mudanças relevantes de vínculo de OS direta ou referência unilateral de Chamado cancelado, tomando lock compartilhado dos Chamados afetados. Escritores e cancelamento competem pelo lock: escritor anterior é observado após a espera; escritor posterior recebe rejeição. A proteção não realiza reabertura automática e não modifica OS. Deadlock pode abortar uma transação, sem presumir retry de integração externa.

Com gate desligado, a regra nova não recusa operações; a aplicação da migration ainda adiciona triggers e uma leitura do gate, com custo e compatibilidade a avaliar. Não habilitar em produção sem inventário de escritores, tratamento de conflitos, teste integrado e revisão adversarial. Rollback operacional é fechar o gate; a remoção de triggers é separada e requer aprovação. A estratégia não elimina índice singular, nem ativa 1:N.

Ensaio em cluster descartável, com gates habilitados apenas nele e trigger 1028 instalado: mudança de status de OS legada, INSERT de OS direta e troca de referência unilateral concorreram com o cancelamento nas duas ordens. Cancelamento primeiro rejeitou cada escritor após espera; escritor primeiro fez o cancelamento recusar OS pendente ou revisão obsoleta. Na criação, o teste precisou liberar o número sintético herdado de OS desvinculada: sem isso, o trigger de numeração produziu violação de unicidade, reafirmando que 1:N ainda não está liberado. Outros escritores e integrações permanecem sem prova. O cluster de ensaio foi removido.
