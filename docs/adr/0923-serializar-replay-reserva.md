---
name: "docs-adr-0923-serializar-replay-reserva-md"
description: "Documento Sinérgica SO: ADR-0923 — Autorização transacional do replay de reserva"
alwaysApply: false
---

# ADR-0923 — Autorização transacional do replay de reserva

Data: 2026-10-30 · Status: preparado, não aplicado ou homologado.

## Contexto e decisão

Os triggers 1086/1087 não executam quando liberação ou conversão já existe. Com autorização 0246 e triggers 0319 em banco sintético, uma barreira de teste após a checagem da alocação permitiu que replay de conversão retornasse dados financeiros depois de a concessão ter sido revogada e confirmada; não houve nova alocação.

Preparar substituição aditiva das duas RPCs da 0737 preservando assinaturas, lógica, ordem dos locks e privilégios. Após bloquear o item e antes de consultar o comando anterior, tentar a trava compartilhada da 0319 e revalidar `faturavel.efetivar` no Cliente do documento. Se alteração estiver aberta, falhar imediatamente; se já revogada, negar. A trava persiste até commit/rollback e cobre tanto novo comando quanto replay. Os triggers 1086/1087 permanecem como defesa para outros inserts.

Não abrir gates nem ampliar grants. Revisar todos os consumidores, ordem de locks e fontes de autorização, incluindo revogação de sessão. Testar concorrência nas duas ordens, repetição, conflito e rollback com esquema completo e RLS; executar revisão adversarial antes de implantar. Essa proteção não cobre outras RPCs financeiras.

## Reversão

Manter gates fechados; se implantada, restaurar corpos da 0737 em nova migration revisada, sem apagar histórico. A reversão reabre a janela e não é estado seguro.
