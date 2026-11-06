---
name: "docs-adr-0324-reconciliacao-conferencia-validacao-md"
description: "Documento Sinérgica SO: ADR-0324 — Reconciliação de conferência e validação do retorno"
alwaysApply: false
---

# ADR-0324 — Reconciliação de conferência e validação do retorno

Status: proposta, não homologada.

Uma conferência estrutural é associada a uma revisão específica das evidências e não pode ser tratada como atual se novas evidências forem declaradas. A prévia compara conferência selecionada com a revisão corrente, registra a existência de decisões versionadas e expõe impedimentos. A conferência verifica a estrutura no instante em que foi feita, não autenticidade do conteúdo externo; identidade da resolução pode mudar depois. A consulta não transforma atestação em `cobertura_comprovada` nem aprova retorno ou encerra OS.

Antes da aprovação efetiva é necessário revalidar transacionalmente vínculo, snapshot, respostas, integridade das fontes, versão das decisões e política de evidência; ausência de evidência autenticada segue bloqueio. Gate e EXECUTE ficam fechados e testes/revisão adversarial são obrigatórios.
