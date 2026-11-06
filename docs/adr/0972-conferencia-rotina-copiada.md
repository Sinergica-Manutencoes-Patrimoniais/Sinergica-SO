---
name: "docs-adr-0972-conferencia-rotina-copiada-md"
description: "Documento Sinérgica SO: ADR-0972 — Conferência de Rotina copiada antes da aprovação"
alwaysApply: false
---

# ADR-0972 — Conferência de Rotina copiada antes da aprovação

Status: preparação privada; não homologada.

Rotinas copiadas por Plano inteiro ou por modelo individual exigem declaração explícita do gestor antes da aprovação. A declaração identifica ator, Cliente, Plano, versão e Rotina, revisão do Plano, justificativa e resumo de todos os campos da Rotina e do questionário atual. Mudança posterior da revisão, da Rotina ou do questionário invalida a conferência. A declaração é auditada e imutável, com requestId para repetição idêntica. Ela não comprova que a exigência normativa foi interpretada corretamente nem substitui os contratos de perguntas e evidências.

Uma guarda de aprovação verifica transacionalmente as Rotinas copiadas ainda presentes na versão; se houver cópia sem conferência correspondente, ou se a guarda estiver fechada, recusa a aprovação. A remoção legítima da Rotina do rascunho não impede a aprovação. Cópias novas, leituras, registros e a guarda dependem de rollout coordenado; nenhum EXECUTE operacional é concedido aqui. Não ativar antes de conferir FORCE RLS, privilégios do proprietário, ordem de locks de Plano/versão/Rotina/questionário, todos os caminhos de aprovação e edição, integridade dos recibos, autorização/revogação, cópias legadas, concorrência e revisão adversarial. Manter gates fechados e não aplicar em produção.

Os registros históricos guardam o ID da Rotina sem chave estrangeira que impeça sua retirada física no rascunho; a criação e conferência validam o vínculo antes de registrar. Não reutilizar IDs retirados. Validar a política de exclusão e todos os consumidores históricos antes de ativar.

A consulta da conferência devolve resumo do estado atual; o comando exige o mesmo resumo e revisão, recusando mudanças entre consulta e declaração. O resumo não demonstra que o operador tenha efetivamente lido ou compreendido todos os conteúdos; a tela deve deixar explícita sua responsabilidade.

A consulta compara o JSON integral do questionário da fotografia aprovada com o cadastro atual quando o gestor também tem acesso à origem; igualdade inclui metadados e vale somente no instante da leitura. Fonte restrita ou fotografia incompleta resulta em estado indeterminado, sem revelar dados da origem. A comparação não valida o conteúdo nem substitui conferência humana. Revisar concorrência com os escritores de fotografia, limites e autorização em ambas as pontas antes de ativar.
