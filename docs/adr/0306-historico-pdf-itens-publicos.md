# ADR-0306 — Itens estruturados no histórico e PDF

Status: proposta; gate e concessões fechados, testes pendentes.

Versões com snapshot estruturado exibem e exportam seus itens públicos exatos, sem custos. A leitura exige vínculo atual e versão efetivamente publicada; antes de entregar o PDF a autorização e os snapshots são consultados novamente. Versões antigas sem snapshot são explicitamente identificadas, sem inventar itens ou bloquear leitura do conteúdo histórico anterior. Falha de consulta não se confunde com ausência de snapshot. Depende de revisão de isolamento, revogação, exportação e concorrência antes de ativação.
