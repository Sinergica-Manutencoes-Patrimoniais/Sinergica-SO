---
name: "docs-adr-0407-guarda-escritores-escopo-preventivo-md"
description: "Documento Sinérgica SO: ADR-0407 — Guarda opt-in de escritores de OS"
alwaysApply: false
---

# ADR-0407 — Guarda opt-in de escritores de OS

Status: preparado, gate desligado, sem aplicação ou homologação. Ao habilitar, o trigger serializa alterações de vínculo, Cliente, exclusão e inserção de OS usando o mesmo lock da ocorrência preparada da declaração 0626. Após qualquer declaração registrada, essas alterações são bloqueadas para a ocorrência vinculada; transições de status permanecem permitidas. Desligado, o legado segue inalterado.

Esta guarda não prova que a lista declarada incluiu todas as OS, nem protege fontes além de `ordens_servico`, o vínculo 0340 ou mudanças não modeladas. Não habilitar sem inventário e revisão de todos os escritores, testes de concorrência, política explícita de reconciliação/reabertura e plano de rollback. Não conclui ocorrência, não cancela OS e não aciona Auvo. Ocorrências de Visita sem ponte continuam não cobertas.
