---
name: "docs-adr-0584-integridade-ponte-visita-md"
description: "Documento Sinérgica SO: ADR-0584 — Guardas de identidade da ponte de Visita"
alwaysApply: false
---

# ADR-0584 — Guardas de identidade da ponte de Visita

Sob gate desligado por padrão, alterações ou exclusões de ocorrência preparada e origem contratual já vinculadas são recusadas. Na ocorrência legada vinculada, são protegidos ID, Plano e vencimento, preservando demais atualizações operacionais. O vínculo em si já é imutável pela migration 0723. A proteção alcança vínculos existentes, sem conceder permissões ou habilitar gate.

Estas guardas não comprovam serialização entre criação do vínculo e alterações concorrentes, nem substituem protocolo de locks ou revisão dos escritores. A barreira 0729 permanece, e a ativação depende de revisão, testes e homologação. Fora do gate não há mudança no comportamento legado.
