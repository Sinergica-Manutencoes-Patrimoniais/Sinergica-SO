---
name: "docs-adr-0751-mediacao-upload-comprovantes-md"
description: "Documento Sinérgica SO: ADR-0751 — Mediação de upload de comprovantes de despesa"
alwaysApply: false
---

# ADR-0751 — Mediação de upload de comprovantes de despesa

Status: experimental, gate fechado; não homologado.

A política de Storage precisa executar uma função de autorização, mas a função de 0412 foi revogada para `authenticated`. O resolvedor de metadados também está revogado. A migration 0966 prepara gate específico desligado, autorização estritamente por caminho/Cliente/despesa e capacidade atual, e resolvedor mediado para o próprio objeto. Leitura, atualização e exclusão diretas continuam proibidas. Não há URLs públicas.

A autorização usa o mesmo lock consultivo de permissões de 0319, exige READ COMMITTED e mantém lock do gate e da despesa até o fim da transação de banco. O resolvedor não comprova os bytes e não permite recuperar upload incerto: o frontend mantém falha fechada. O Storage e o banco não compartilham transação de bytes; testar autenticação, Storage real, revogação, owners e concorrência antes de habilitar. Não há deploy, processamento externo nem autorização de homologação.

Políticas de INSERT de outros buckets privados usam helpers revogados. Em teste, PostgreSQL verificou suas permissões mesmo com condições `CASE` restringindo a avaliação ao bucket correspondente. Não se alteram essas políticas nem se concedem helpers alheios: mediação Storage coordenada entre buckets permanece bloqueadora.
