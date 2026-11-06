---
name: "docs-adr-0665-promocao-backlog-chamado-md"
description: "Documento Sinérgica SO: ADR-0665 — Promoção integral de composição a Chamado"
alwaysApply: false
---

# ADR-0665 — Promoção integral de composição a Chamado

Comando atômico, fechado por gate, promove a composição inteira previamente selecionada; não permite promover subconjunto nem cria OS. Revalida Cliente, revisão e Pendências, cria Chamado com numeração canônica, usa comandos de parcelas e vínculos existentes, registra auditoria e preserva fontes. Repetição da requisição retorna o mesmo resultado. Uma composição já vinculada ou com origem obsoleta é recusada.

A implementação não resolve promoção parcial, devolução ou reconciliação de escritores legados. Ordem global de locks, integrações/efeitos de gatilhos, autorização e concorrência exigem revisão adversarial e testes antes de habilitar. Não concede permissões, ativa gates, aplica migration ou chama Auvo.

O comando só chama o gerador de número após verificar os três gates dos comandos aninhados. Sequências PostgreSQL não revertem numeração em falhas posteriores: lacunas podem ocorrer. O campo `pergunta` da Pendência é chave; a descrição é obtida exclusivamente do texto único do questionário congelado na versão aprovada ligada à OS e retorno. Texto ausente, ambíguo ou acima do limite bloqueia a promoção; vínculo por Visita ainda não é suportado por este resolvedor. O evento legado `criado` é ignorado pelo notificador de Portal na definição 0143, mas o estado real de triggers em ambiente precisa ser auditado.
