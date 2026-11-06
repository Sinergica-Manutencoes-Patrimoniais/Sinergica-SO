---
name: "docs-adr-0838-avaliacao-aptidao-os-legada-md"
description: "Documento Sinérgica SO: ADR-0838 — Avaliação de Chamado com OS de vínculo legado"
alwaysApply: false
---

# ADR-0838 — Avaliação de Chamado com OS de vínculo legado

Estado: proposta local, gates fechados, não homologada. Complementa ADR-0111, ADR-0395 e ADR-0834.

A avaliação 0330 e o diagnóstico 0621 contavam somente OS com `chamado_id` direto. Em teste isolado, Chamado com OS direta finalizada, escopo atendido e OS singular unilateral em execução foi diagnosticado como apto. O sistema não pode omitir a OS pendente apenas porque seu vínculo inverso ainda não foi migrado.

As duas avaliações e as páginas de diagnóstico passam a considerar a união dos vínculos direto e singular unilateral, sem duplicar uma OS. A resolução privada verifica as mesmas ambiguidades e divergências rejeitadas pela leitura 0312 antes de produzir resultados. Não expõe uma RPC nova, não altera dados, permissões ou gates, e não infere encerramento. A paginação e joins de parcelas/continuações usam a mesma regra para não discordar dos totais. Funções públicas existentes permanecem sem EXECUTE.

Esta mudança não corrige os comandos de fechamento 0333/0611, nem garante serialização com escritores legados. Eles também devem ser adaptados e testados antes de qualquer ativação; não usar este diagnóstico como autorização de fechamento. Exige CI, testes concorrentes e revisão adversarial. Rollback funcional requer migração posterior restaurando os corpos anteriores; isso reintroduz o risco de omissão, sem apagar dados.
