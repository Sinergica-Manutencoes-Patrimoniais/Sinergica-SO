# ADR-0051 — Comparação preliminar de versões

**Status:** decisão para implementação local E01-S165. **Data:** 2026-10-27.

A prévia paginada compara a última versão aprovada congelada com a versão de rascunho, por identidade lógica de Rotina. Classifica adição, retirada, alteração ou manutenção de campos operacionais, inclusive conteúdo atual do questionário. Retorna revisão do Plano e declara explicitamente que os efeitos sobre Ocorrências e OS não foram calculados; a comparação não autoriza aprovação nem materializa execução.

A consulta é restrita a `plano.gerir`, não modifica histórico e não substitui a futura prévia transacional de impactos com E01-S166/E01-S167. A aprovação de nova versão continua bloqueada até existirem essa integração e vigências não sobrepostas. Snapshot inexistente é erro, não autorização para inferir passado a partir do cadastro atual.
