---
name: "docs-adr-0408-protocolo-parcial-composicao-md"
description: "Documento Sinérgica SO: ADR-0408 — protocolo parcial dos escritores de composição"
alwaysApply: false
---

# ADR-0408 — protocolo parcial dos escritores de composição

Status: proposto; não aplicado nem homologado.

Quando o gate de composição estiver ativo, as RPCs canônicas de associar OS e adicionar pessoa adquirem locks de pedido e de composição por Visita antes de invocar suas implementações existentes. A intenção local usa a mesma ordem. Com gate fechado, os wrappers não adquirem novos locks e delegam ao comportamento original. As funções base não são acessíveis diretamente aos papéis de aplicação.

Este é somente um passo: transferências, encerramentos, escrita direta, alterações de status de OS e funcionário e outras rotas precisam ser inventariadas e adaptadas ao mesmo protocolo. A conferência e operações multi-Visita também exigem coordenação. A guarda 0632 permanece fechada e não se deve ativar composição até revisão, drenagem e testes concorrentes. Não há despacho externo.
