---
name: "docs-adr-0132-inbox-privada-origem-campo-md"
description: "Documento Sinérgica SO: ADR-0132 — Inbox privada para origem de campo"
alwaysApply: false
---

# ADR-0132 — Inbox privada para origem de campo

**Estado:** proposta não aplicada nem homologada. Complementa ADR-0026.

## Decisão

Preparar recepção transacional privada de envelopes de eventos de tarefa, sem alterar os caminhos atuais de webhook e importação. A identidade explícita é integração, task e chave de evento fornecida pelo adaptador; repetir essa identidade com o mesmo conteúdo retorna o mesmo registro, e conteúdo diferente é conflito observável. O Cliente externo pode permanecer desconhecido; o envelope fica pendente sem criar Chamado, OS, ativo ou tarefa externa. O conteúdo permanece privado, com limite de tamanho e trilha de recepção sem incluir payload na auditoria.

O comando exige identidade de serviço e também fica revogado, com gate fechado. Nenhuma entrada é autenticada por esta migration: o adaptador terá de comprovar origem, HMAC ou polling legítimo e produzir identidade e timestamp verificáveis antes da chamada. A chave de evento não comprovada entre webhook e polling não garante deduplicação cross-canal; o vínculo único de task e processamento transacional devem ser implementados antes da ativação.

## Limites

Inbox não substitui o webhook atual e não processa eventos, resolve Cliente, cria OS/Chamado provisório, estabelece ordem confiável nem despacha levantamento ao staging. Payload pode conter dados pessoais e referências de anexos: antes de habilitar, definir minimização, retenção, acesso auditado, criptografia e recuperação compatíveis com LGPD. Exigir testes com duas sessões, HMAC, idempotência e isolamento, além da revisão adversarial. Não apagar registros na reversão; preservar e migrar fatos antes de desativar a estrutura.
