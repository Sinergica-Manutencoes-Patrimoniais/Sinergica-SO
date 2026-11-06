---
name: "docs-adr-0806-e01-s180-ingestao-digest-comprovante-md"
description: "Documento Sinérgica SO: ADR-0806 — Ingestão de comprovante com digest calculado no servidor"
alwaysApply: false
---

# ADR-0806 — Ingestão de comprovante com digest calculado no servidor

Status: preparação isolada; sem rollout, endpoint conectado ou homologação.

O Storage testado não comprovou leitura de versão antiga. Digest não implica imutabilidade; deve servir para identificar divergência dos bytes lidos. Nunca aceitar digest do cliente como atestado.

Preparar fluxo que autentica e autoriza, limita os bytes, calcula SHA-256 no servidor, reserva request/ator/despesa/digest, cria objeto novo sem sobrescrever, lê os bytes efetivamente armazenados e compara digest, reautoriza e então confirma o vínculo. Uma reserva pendente não deve causar novo upload nem confirmar automaticamente sem prova de identidade; resposta incerta mantém bloqueio. Na leitura, consultar digest atestado e autorização atual, verificar bytes devolvidos e reautorizar antes de responder.

O código isolado não é serviço completo: falta reserva e confirmação transacionais autorizadas, fonte persistente auditada do digest, revalidação sob concorrência, mediação real do Storage, integração à realização e leitura, além de revisão adversarial. O hash verificado é uma fotografia dos bytes lidos, não garante que eles permaneçam iguais após a confirmação. Nenhum gate, política ou serviço externo é habilitado por esta decisão.

## Preparação transacional 1003

A migration prepara reserva imutável e confirmação separada, com request único, ator, Cliente, despesa, digest e caminho reservado. A confirmação exige objeto privado existente no caminho reservado e autorização corrente; registra auditoria. A função de comando permanece revogada para todos os papéis de aplicação e o novo gate inicia fechado. A origem do digest continua dependendo da futura mediação Edge confiável: SQL não lê os bytes e não os atesta. O vínculo de confirmação não realiza a despesa nem altera o Financeiro.

## Mediação preparada 1005

Um wrapper de serviço expõe somente operações de reserva e confirmação ao papel `service_role`, mantendo o comando interno revogado e conferindo também o papel do JWT. O Edge futuro deve obter a identidade do usuário com autenticação validada, calcular e verificar o digest dos bytes, e nunca divulgar nem usar a credencial de serviço no cliente. A concessão ao serviço não abre os gates. Sem integração e testes de ponta a ponta, não autoriza deploy nem comprova integridade dos bytes ou do objeto após confirmação.
