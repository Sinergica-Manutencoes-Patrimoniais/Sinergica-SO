---
name: "docs-adr-0386-retificacao-vinculo-os-rotina-md"
description: "Documento Sinérgica SO: ADR-0386 — Invalidação e retificação do vínculo OS–Rotina"
alwaysApply: false
---

# ADR-0386 — Invalidação e retificação do vínculo OS–Rotina

Status: proposta; gate fechado, sem testes.

O vínculo original e seu snapshot não são alterados. O PCM pode invalidá-lo com motivo e, depois, registrar retificação como revisão imutável, mediante nova prévia da cadeia e snapshot aprovado comprovados; não há reativação automática. Cada transição exige revisão esperada e pedido idempotente, com autorização e lock da OS. O registro é histórico e não autoriza despacho nem substitui revalidação da cadeia ao usá-lo. Alterações indiretas podem torná-lo obsoleto sem evento de invalidação; reconciliar e testar concorrência, permissões e correções antes de ativar.
