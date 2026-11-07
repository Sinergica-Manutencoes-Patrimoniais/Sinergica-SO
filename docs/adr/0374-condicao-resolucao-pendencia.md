---
name: "docs-adr-0374-condicao-resolucao-pendencia-md"
description: "Documento Sinérgica SO: ADR-0374 — Condição técnica revisada na resolução"
alwaysApply: false
---

# ADR-0374 — Condição técnica revisada na resolução

Prepara-se versão do comando de resolução humana que exige referência à revisão mais recente de contexto com condição técnica não vazia e atestação explícita de seu atendimento. A comparação ocorre sob bloqueio da Pendência; mantém-se a verificação de evidência declarada, OS corretiva e retorno aprovados do comando anterior. A referência à revisão é registrada de forma imutável e idempotente.

A assinatura anterior é fechada para evitar contorno; não há inferência automática nem garantia de autenticidade da evidência. A interface deve migrar para a nova versão e demonstrar a condição ao PCM antes de habilitar. Gates, permissões, testes, concorrência e revisão adversarial continuam pendentes.
