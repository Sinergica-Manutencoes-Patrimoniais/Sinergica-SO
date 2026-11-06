---
name: "docs-adr-1540-vinculo-legado-contradiz-exclusao-md"
description: "Documento Sinérgica SO: ADR-1540 — Vínculo legado contradiz classificação não relacionada"
alwaysApply: false
---

# ADR-1540 — Vínculo legado contradiz classificação não relacionada

Uma relação declarada pode ser retirada sem que pontes de ocorrências já existentes sejam apagadas. Essas pontes são evidência direta de relação entre o Plano legado e o Plano revisado; uma classificação humana negativa não pode descartá-las.

A fotografia da classificação rejeita pontes de calendário ou Visita que liguem ocorrências do legado ao Plano. Na avaliação, a mesma evidência torna a classificação anterior inválida. Prévia, gravação e avaliação travam as tabelas de ponte para evitar alteração entre verificação e commit. Nenhum vínculo, OS ou ocorrência é alterado, e a guarda 1045 permanece intacta.

Testar concorrência, revogação, planos sem pontes e múltiplos Clientes em clone. Estas travas têm abrangência global e precisam de avaliação operacional; pontes registradas não provam ausência de fontes externas. Reversão restaura as funções da migration 1680, sem apagar registros.
