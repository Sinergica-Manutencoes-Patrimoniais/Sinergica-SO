---
name: "docs-adr-1326-natureza-copia-rotina-modelo-md"
description: "Documento Sinérgica SO: ADR-1326 — Natureza na cópia de Rotina modelo"
alwaysApply: false
---

# ADR-1326 — Natureza na cópia de Rotina modelo

Status: preparado; gate existente permanece desligado.

Ao copiar uma Rotina aprovada entre Planos, preservar a natureza técnica apenas
quando origem e destino pertencerem ao mesmo Cliente e apontarem ao mesmo
cadastro de Equipamento/Componente. A origem é a fotografia aprovada, com
hash do item conferido contra o recibo da cópia. Natureza ausente permanece
ausente; alvo diferente ou Cliente diferente exige declaração própria. Uma
origem ambígua, natureza inválida ou destino divergente interrompe a cópia
na mesma transação. Não altera fotografias aprovadas nem cadastros existentes.

O trigger executa somente ao inserir o recibo da cópia e somente com o gate de
natureza habilitado. Repetir a requisição retorna o recibo existente; não faz
uma segunda alteração. Rollback desativa o gate antes de remover o trigger e a
função, sem apagar dados já declarados. Revisar concorrência, permissões,
comandos legados, compatibilidade e efeitos em revisões antes de habilitar.
