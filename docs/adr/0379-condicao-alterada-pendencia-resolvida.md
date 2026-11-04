# ADR-0379 — Condição alterada após resolução

Consulta privada compara a condição técnica da última resolução humana com o último contexto declarado quando a Pendência permanece resolvida. Alteração é sinalizada ao PCM e requer decisão explícita de reabertura pelo comando existente; não se muda estado automaticamente. Mudança apenas de norma, mantendo a mesma condição, não é tratada como alteração da condição.

Ausência de dados da resolução ou do contexto é reportada como indeterminada, sem inferir validade. Gate e execução permanecem fechados; testes de autorização, concorrência e histórico são necessários antes de ativar.
