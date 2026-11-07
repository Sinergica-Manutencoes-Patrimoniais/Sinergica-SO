---
name: "docs-adr-1423-aprovacao-finalizacao-atomica-os-md"
description: "Documento Sinérgica SO: ADR-1423 — Aprovação e finalização atômicas da OS"
alwaysApply: false
---

# ADR-1423 — Aprovação e finalização atômicas da OS

E01-S168 exige que a aprovação PCM encerre a OS individual. A atestação preparada e a finalização existente serão compostas em uma única transação, com o mesmo identificador de pedido, revisão de evidências e decisão, identificação e fotografia da OS. Qualquer recusa desfaz ambas; repetição usa os recibos e verificações de identidade já existentes. Chamado não é alterado pela nova composição.

A entrada terá controle próprio desligado e mantém os controles das operações internas. Não representa autenticação das evidências, não conclui automaticamente a ocorrência e não habilita o caminho legado. Antes de uso: verificar os efeitos de triggers de encerramento, concorrência, repetição, autorização e RLS, completude das pendências, notificações e revisão adversarial. A comprovação de execução no Auvo permanece dependência separada.
