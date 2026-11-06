---
name: "docs-adr-0416-barreira-status-composicao-md"
description: "Documento Sinérgica SO: ADR-0416 — barreira provisória para fontes compartilhadas"
alwaysApply: false
---

# ADR-0416 — barreira provisória para fontes compartilhadas

Status: proposto; não aplicado nem homologado.

O inventário estático encontrou alterações de OS por rotinas em 0077, 0169, 0178 e por adaptadores de aplicação, além de operações diretas sobre funcionários em `supabase-funcionarios-adapter.ts`. Esse inventário não comprova ausência de outros escritores, integração Auvo, SQL privilegiado ou referências indiretas.

Não é seguro adquirir locks de escopo de Visita em gatilho de linha já bloqueada: isso inverte a ordem de intenção/associação. Enquanto o gate de composição estiver habilitado, uma barreira provisória rejeita alterações dos campos de status ou exclusão em fontes que já tenham vínculos ativos. Com gate fechado, mantém o fluxo legado sem novos locks de linha. Não há bypass pela aplicação.

Esta barreira não resolve inserção concorrente de vínculo nem substitui um protocolo único entre todos os escritores. Pode bloquear operações legítimas se o gate for ligado; não o ativar. Guarda 0632 segue fechada até inventário completo, desenho de serialização, testes de concorrência e revisão adversarial. A migração não faz alteração de registros operacionais.
