---
name: "docs-adr-0627-aplicar-localizacoes-selecao-md"
description: "Documento Sinérgica SO: ADR-0627 — Aplicação selecionada de campos de localização"
alwaysApply: false
---

# ADR-0627 — Aplicação selecionada de campos de localização

Status: proposta; gate fechado, não homologada.

O PCM fornece até 50 decisões explícitas, incluindo confirmação, motivo, identificadores de tentativa próprios e snapshot completo para atualizações; criação usa destino e snapshot nulos. O executor conserva a ordem selecionada, encadeia revisões e chama exclusivamente o comando 0845. Qualquer falha reverte toda a seleção; resultados e retry preservam identidade por item. Não amplia permissões nem aplica diretamente em outros Clientes.

Os gates 0845 e 0852 e as RPCs continuam fechados. A garantia de não sincronizar depende da revisão e testes integrados do comando 0845 e dos gatilhos; interface ainda pendente. Sem aplicação ou testes nesta etapa.
