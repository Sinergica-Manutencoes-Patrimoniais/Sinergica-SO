---
name: "docs-adr-1272-processamento-atomico-origem-campo-md"
description: "Documento Sinérgica SO: ADR-1272 — Criação transacional a partir de tarefa de campo"
alwaysApply: false
---

# ADR-1272 — Criação transacional a partir de tarefa de campo

Status: proposta local; não aplicada nem homologada.

Preparar comando exclusivo de serviço que, após captura e normalização sob contrato explicitamente habilitado, resolve Cliente, identidade externa de OS e referência de Chamado nessa ordem. Cliente desconhecido ou identidade divergente permanece pendente. Referência comprovada para Chamado ativo do mesmo Cliente é reutilizada; referência ausente, inválida ou de outro Cliente cria contêiner provisório sem alterar o Chamado incompatível. Número e UUID existentes são preservados.

O comando serializa por tarefa, registra resultado imutável por tarefa e salva Chamado, OS, vínculo, proveniência e auditoria na mesma transação. Tarefa já identificada não cria outra OS; um `externalId` de OS do mesmo Cliente é vinculado somente quando não conflita com outra tarefa. Eventos posteriores não sobrescrevem dados corrigidos nem regridem execução: atualização ordenada é etapa separada. O conteúdo integral permanece na inbox; referências de fotos não são importadas. Conclusão em campo não implica validação PCM ou fechamento de Chamado.

O contrato e o gate nascem fechados, sem interface de configuração ou executor. A projeção normalizada deve ser produzida por adaptador confiável a partir do envelope e não por texto livre. Antes de conectar ou ativar, comprovar o formato e semântica Auvo, revisão/ordenação, autor de sistema, fontes e integridade da projeção, campos de técnico/fotos/horários, estados de conclusão, todos triggers e consumidores, concorrência com caminhos legados, transição de cardinalidade e números, RLS/FORCE, rollback, replay e revisão adversarial. Não usar em dados reais nesta etapa.
