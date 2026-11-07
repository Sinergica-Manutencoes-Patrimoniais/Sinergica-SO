---
name: "docs-adr-0595-registro-grupo-revisao-md"
description: "Documento Sinérgica SO: ADR-0595 — Revisão na confirmação de ocorrência Grupo"
alwaysApply: false
---

# ADR-0595 — Revisão na confirmação de ocorrência Grupo

A prévia autorizada apresenta ID, revisão e quantidade do Grupo, sem conversão numérica sujeita a perda. O comando revisado trava o Grupo, exige a revisão apresentada e chama o registro aditivo 0815; não cria OS ou fila. Gates e concessões permanecem fechados.

O comando original 0815 também permanece privado e não deve receber concessão direta. Repetir a tentativa usa o mesmo identificador; se o Grupo mudar entre tentativas, o resultado deve ser reconciliado antes de novo comando. Conflitos entre versões, concorrência global, testes e homologação continuam pendentes.
