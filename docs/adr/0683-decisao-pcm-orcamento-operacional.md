---
name: "docs-adr-0683-decisao-pcm-orcamento-operacional-md"
description: "Documento Sinérgica SO: ADR-0683 — Decisão versionada de orçamento por PCM"
alwaysApply: false
---

# ADR-0683 — Decisão versionada de orçamento por PCM

Status: preparado, gate fechado, não aplicado nem homologado.

PCM com capacidade `orcamento.emitir` e `execucao.validar` registra decisão própria sobre versão publicada e vigente de proposta vinculada à mesma OS e Cliente, com motivo e referência de evidência declarada. O comando altera a proposta canônica e cria decisão com autoria PCM, sem criar OS, tarefa, cobrança ou envio externo. A referência é uma declaração interna, não prova autenticidade de aceite do Cliente; esse comando não registra comando de Portal nem deve ser interpretado como confirmação pessoal do Cliente. Regras que exigem prova específica de aceite continuam bloqueadas.

Solicitação é idempotente pelo request e payload; Cliente, OS, lista, publicação, prazo, versão e exceção de piso são revalidados no servidor. Gate e grants fechados. Antes de ativar, revisar política de alçada de decisão PCM, semântica de evidência/aceite, todos os triggers e integração financeira/Portal, concorrência, RLS, migrações e testes adversariais. Sem oportunidade artificial ou OS substituta.
