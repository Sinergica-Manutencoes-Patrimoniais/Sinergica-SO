---
name: "docs-adr-1268-levantamento-estruturado-recepcao-md"
description: "Documento Sinérgica SO: ADR-1268 — Preparação estruturada para recepção de levantamento"
alwaysApply: false
---

# ADR-1268 — Preparação estruturada para recepção de levantamento

Status: proposta local; não homologada nem ativada.

Conectar o preparador determinístico de questionário ao contrato de recepção de envelope já existente por uma porta transacional injetada. A entrada deve conter contexto explícito de ator, Cliente, OS, envelope, tarefa e request; todos os identificadores de origem preparados devem coincidir com esse contexto antes de chamar a porta. Não deduzir dados de prosa, não criar ativos e não importar imagens automaticamente.

O comando efetivo de recepção deve executar com a sessão do ator e usar as verificações de triagem, tarefa, Cliente, OS, idempotência e autorização já existentes. O serviço não deve usar service role para simular usuário, nem afirmar autenticidade da origem ou confirmação de fotos. Resultado incerto exige recuperar ou repetir o mesmo request e conteúdo; não gerar novo request automaticamente.

A composição ainda depende de entrada autenticada e contrato de questionário versionado e comprovado. Não registrar endpoint, habilitar gate ou enviar dados reais antes de validar contrato Auvo, autorização/RLS, concorrência de triagem, limites, replay, perda de resposta e revisão adversarial.
