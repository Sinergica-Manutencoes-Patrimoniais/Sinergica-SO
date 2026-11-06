---
name: "docs-adr-1559-escolha-nova-visita-contratual-md"
description: "Documento Sinérgica SO: ADR-1559 — Escolha de outra Visita contratual existente"
alwaysApply: false
---

# ADR-1559 — Escolha de outra Visita contratual existente

Status: fundação proposta, incompleta e não homologada. A escolha da nova data de uma Rotina por Visita deve apontar a uma Visita regular já existente da mesma série e Cliente; não cria, desloca ou reprograma Visita. A comparação do PCM, data original, Visita, regra, semana, revisão e fonte declarada de feriados são preservadas e revalidadas; datas devem respeitar a vigência aprovada. Feriados declarados bloqueiam a escolha; a ausência de declaração não comprova cobertura completa. OS, Chamados, Grupo e demais efeitos impedem substituição sem reconciliação. A guarda 1045 permanece inalterada.

Esta fatia somente prepara escolha e revalidação privadas. Ainda faltam integração à avaliação e aprovação, selo, retirada explícita da fila anterior, vínculo na geração canônica, UI e testes de concorrência; não conceder acesso ou habilitar fluxo até concluí-los.
