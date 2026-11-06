---
name: "docs-adr-0854-decisao-feriado-calendario-autorizacao-md"
description: "Documento Sinérgica SO: ADR-0854 — Autorização e gates da decisão de feriado"
alwaysApply: false
---

# ADR-0854 — Autorização e gates da decisão de feriado

Status: preparação; não autoriza habilitar gates nem homologar.

## Contexto

A decisão por calendário mantém obrigação para PCM e já trava a linha de
feriado. Ensaio com duas sessões mostrou, porém, que revogação de permissão
ou fechamento de qualquer dos dois gates podia ocorrer após a validação e
antes do commit, ou ficar pendente enquanto a decisão prosseguia.

## Decisão

Preservar RPC, OID, parâmetros, ACL, replay e data original. Antes do trabalho
efetivo, exigir READ COMMITTED, tomar sem espera trava compartilhada do
protocolo global de autorização, revalidar `plano.gerir` e reter os gates de
decisão e de feriado com `FOR SHARE NOWAIT`. Em contenção devolver 55P03.
Falhar se a definição preexistente não corresponder ao marcador esperado;
nenhuma policy ou gate é habilitado pela migration.

## Limites

Não comprova vínculo contratual de feriado específico, fontes de feriados,
relação Plano/Cliente, concorrência de todos os escritores ou revogação externa
de JWT. Avaliar contenção e executar revisão adversarial antes de homologar;
testes isolados não significam deploy.
