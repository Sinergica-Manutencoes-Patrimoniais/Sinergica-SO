---
name: "docs-adr-1267-transporte-auvo-t24-sem-repeticao-md"
description: "Documento Sinérgica SO: ADR-1267 — Transporte Auvo T−24 sem repetição automática de escrita"
alwaysApply: false
---

# ADR-1267 — Transporte Auvo T−24 sem repetição automática de escrita

Status: proposta local; não homologada nem ativada.

O protocolo T−24 exige que uma resposta incerta de criação ou alteração seja reconciliada antes de nova escrita. O cliente Auvo legado repete chamadas após respostas 401 e 429, inclusive escritas. Para o novo protocolo, acrescentar funções de chamada única ao cliente compartilhado e um adaptador que as use para tarefas, sem alterar o comportamento dos consumidores legados.

Contrato, leitura de páginas e interpretação dos envelopes permanecem dependências explícitas, fornecidas por composição confiável. O adaptador não afirma cobertura de busca ou correção do contrato, não registra rota nem agenda executor e não autoriza rede por si só. Erro ou timeout não demonstra que o efeito remoto foi cancelado. Nenhum retry de escrita é permitido no transporte; a reconciliação permanece responsável pelo estado incerto.

Antes de integração operacional: comprovar contrato e cobertura de busca, autenticação e renovação, formatos de POST/PATCH/GET e leitura posterior, timeout e resposta tardia, segredos e logs, concorrência, compatibilidade, testes de integração e revisão adversarial. Gates e ativação permanecem fechados.
