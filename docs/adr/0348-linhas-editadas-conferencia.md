# ADR-0348 — Consulta de linhas editadas por lote

Prepara-se consulta privada e paginada de linhas com edição histórica, indicando última revisão e situação atual de conferência, rejeição ou incorporação no ciclo vigente. Retorna chaves e estados, não conteúdo nem motivos; não assume que linha conferida equivale a lote aprovado. A autorização de aprovação é conferida pelo Cliente do lote.

Gate e execução permanecem fechados. Testes de concorrência, paginação e autorização antecedem ativação.
