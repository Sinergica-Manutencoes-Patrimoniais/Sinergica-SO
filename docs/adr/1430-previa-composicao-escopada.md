---
name: "docs-adr-1430-previa-composicao-escopada-md"
description: "Documento Sinérgica SO: ADR-1430 — Prévia completa para edição de composição"
alwaysApply: false
---

# ADR-1430 — Prévia completa para edição de composição

A tela de edição recebe uma fotografia limitada da proposta e dos itens atuais, incluindo os identificadores de materiais e níveis, para não perdê-los ao salvar. O servidor confirma Cliente, concessões e gate do ADR-1429; mais de 100 itens bloqueia edição em vez de truncar. A versão serve à concorrência do comando. A consulta não envia proposta nem autoriza desconto abaixo do piso.

Antes de ativar: testar todos os escritores legados, alterações diretas de itens sem nova versão, revogação, concorrência, precisão, limites, RLS/FORCE e revisão adversarial.

A prévia calcula identificador da lista e o comando o confere antes de gravar. Ambos usam trava de tabela sem espera para impedir inserções e alterações legadas durante a fotografia ou substituição; isso pode recusar operações concorrentes de outras propostas e deve ser medido antes de ativar. O identificador é controle de concorrência, não assinatura ou prova de autoria.
