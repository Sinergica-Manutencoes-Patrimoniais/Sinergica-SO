---
name: "docs-adr-0358-pendencias-retorno-aprovado-md"
description: "Documento Sinérgica SO: ADR-0358 — Pendências de respostas não OK em retorno aprovado"
alwaysApply: false
---

# ADR-0358 — Pendências de respostas não OK em retorno aprovado

Status: proposta, não homologada.

Comando preparado exige decisão de aprovação versionada atual, histórico de decisões totalmente reconciliado e condição estrutural imediatamente anterior ainda correspondente à revisão de evidências. Para cada resposta `nao_ok`, chama o comando canônico preparado de pendência na mesma transação; duplicidade por resposta segue sua regra existente. Qualquer falha reverte o lote. Não transforma não OK em resolução nem encerra Chamado.

Não foi identificado comando canônico homologado de encerramento individual da OS e seus efeitos. Assim, este comando não atualiza seu status, não afirma encerramento e não aciona Auvo. Regras de autenticidade, decisões e efeitos de OS exigem implementação e revisão próprias. Gates e EXECUTE fechados; testes e revisão adversarial antes da ativação.
