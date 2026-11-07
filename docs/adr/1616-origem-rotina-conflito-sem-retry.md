---
name: "docs-adr-1616-origem-rotina-conflito-sem-retry-md"
description: "Documento Sinérgica SO: ADR 1616 — Conflito de revisão na origem da Rotina"
alwaysApply: false
---

# ADR 1616 — Conflito de revisão na origem da Rotina

Status: aceito para implementação; homologação pendente.

A guarda de revisão usada pela consulta e declaração de origem retorna `P0017` com `revisao_obsoleta` em vez de `40001`, evitando reexecução transacional para conflito de negócio. A declaração conserva sua verificação de replay antes da guarda. A interface só descarta uma rejeição definitiva na primeira tentativa após verificar sessão e pedido; a repetição de resultado incerto permanece disponível. Outros conflitos e erros reais de serialização não são convertidos.
