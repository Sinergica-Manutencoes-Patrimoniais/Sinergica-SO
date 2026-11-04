# ADR-1239 — Histórico das avaliações de reversão

## Decisão

Preparar consulta paginada de avaliações de reversão por Cliente e lote, protegida pela mesma autorização do diagnóstico. Retornar ator, motivo, data, contagens e projeção mínima de Plano, revisão e decisão, sem fotografias ou payload integral. A interface distingue Planos encerrados de pendências, sem interpretar nenhum resultado como exclusão de histórico.

## Limites

Consulta não modifica Plano, não comprova inexistência de dependências e pode observar alterações concorrentes entre páginas. Gates permanecem fechados; validar privacidade do motivo, isolamento entre Clientes, paginação, revogação, RLS/FORCE e revisão adversarial antes de habilitar. Nenhuma migração ou reversão é executada pela leitura.
