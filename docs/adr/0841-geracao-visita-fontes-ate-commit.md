---
name: "docs-adr-0841-geracao-visita-fontes-ate-commit-md"
description: "Documento Sinérgica SO: ADR-0841 — Fontes de geração contratual até commit"
alwaysApply: false
---

# ADR-0841 — Fontes de geração contratual até commit

Status: preparação, gates permanecem fechados; requer revisão e homologação.

## Contexto

Gerador mediado S166 revalida autorização e consulta feriados, mas ensaio com
duas sessões reproduziu alteração de concessão, quatro gates e declaração de
feriado enquanto a geração já havia produzido Visita e aguardava commit.
Isso permite confirmar uma decisão baseada em estado anterior.

## Decisão

Na mediação `sso_pcm_gerar_visita`, preservar assinatura, OID, ACL e núcleo;
exigir READ COMMITTED e adquirir sem espera trava compartilhada existente de
autorização, revalidar capacidades e travar os quatro gates `FOR SHARE NOWAIT`.
Depois adquirir trava compartilhada de feriados. Trigger de statement nas
escritas de `feriados_declarados` adquire a mesma chave em modo exclusivo,
inclusive quando não existia linha de feriado. A contenção do gerador retorna
55P03; escrituras não são despachadas externamente. A serialização só altera
ordem das transações, não recalcula ocorrências já confirmadas.

## Limites

O trigger é permanente e atua em toda escrita legada de feriados,
independentemente dos gates de geração. A chave é global: avaliar contenção,
impacto sobre operações legítimas e possíveis inversões de ordem antes de
qualquer aplicação. Até essa comprovação, não aplicar esta migration fora de
clone sintético descartável.
Protege o caminho mediado, não afirma que outras materializações, escritores
privilegiados que desativem triggers, integrações externas ou alterações de
contrato foram auditados. Provar ambas ordens, replay após commit, mudanças de
gate e feriado, preservação de exceções e revisão adversarial antes de PASS.
