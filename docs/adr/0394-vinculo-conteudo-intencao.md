---
name: "docs-adr-0394-vinculo-conteudo-intencao-md"
description: "Documento Sinérgica SO: ADR-0394 — Vínculo e conteúdo antes da intenção local"
alwaysApply: false
---

# ADR-0394 — Vínculo e conteúdo antes da intenção local

Status: proposta; gates fechados, sem testes e sem despacho.

Para OS preventiva ou vinculada a ocorrência preventiva, a intenção local bloqueada exige além da revisão básica uma conferência prévia do vínculo OS–Rotina, da revisão planejada anterior à confirmação PCM. No momento da intenção, o banco bloqueia a cadeia, revalida a última revisão não invalidada, versão aprovada, alvo e snapshot, e compara com a conferência. Fonte ausente, gate desligado ou divergência bloqueia; OS não preventiva sem ocorrência não ganha requisito de questionário preventivo por inferência. Isso não comprova escopo, equipe, questionário, alterações indiretas revertidas ou contrato Auvo e nunca libera despacho. Exige testes de locks, revalidação e dados legados.
