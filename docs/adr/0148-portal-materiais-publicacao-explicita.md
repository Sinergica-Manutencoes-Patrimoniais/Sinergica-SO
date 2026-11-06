---
name: "docs-adr-0148-portal-materiais-publicacao-explicita-md"
description: "Documento Sinérgica SO: ADR-0148 — Publicação explícita de materiais no Portal"
alwaysApply: false
---

# ADR-0148 — Publicação explícita de materiais no Portal

**Estado:** proposta preparatória, sem homologação nem deploy.

Texto livre e linhas internas podem conter custos, fornecedores ou outros dados privados. Não publicar automaticamente essas fontes: PCM publica uma versão pública explicitamente redigida, limitada a descrições, quantidades e unidades. A lista pública aponta à mesma OS e lista interna; o servidor confere vínculo atual do contato ativo com o Cliente em cada consulta e comando, independentemente do JWT. Disponibilidade do Cliente registra ator, data e revisão como evento informativo da lista interna; não confirma presença física e não altera OS ou Auvo.

As RPCs ficam revogadas e as interfaces de redação no PCM e consulta/informação no Portal são protegidas por flags desligadas. A publicação exige revisão humana: validação de formato não detecta custos ou segredos digitados no texto. Mudança de linhas internas posteriores oculta a publicação anterior até revisão; cada revisão de lista aceita uma publicação imutável. Antes de ativar, validar políticas de contato/ação, concorrência e revogação, exposição de conteúdo, expiração e substituição da publicação, além de testes integrados e revisão adversarial. Orçamento versionado, cobrança pública e anexos ainda não são resolvidos por esta decisão.
