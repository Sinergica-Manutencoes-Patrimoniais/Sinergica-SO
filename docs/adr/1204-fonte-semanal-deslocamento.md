# ADR-1204 — Fonte semanal de deslocamento declarado

## Decisão

Preparar leitura paginada por Visita da última declaração de deslocamento S172, pela semana civil no fuso da Visita. A fonte inclui Visitas sem declaração e identifica declaração cuja revisão não coincide com a Visita atual; ambas permanecem pendentes. Não identifica o pessoal nem presume que uma declaração corresponde à execução. Visitas canceladas ou concluídas são excluídas, sem garantir esforço restante.

A leitura exige as capacidades de Visita e capacidade, os gates existentes e sessão atual. Transferência de Cliente com histórico anterior bloqueia a página. Páginas são consultas independentes, não fotografia transacional; somatório local é parcial, independente de OS, e não é automaticamente adicionado a outras fontes.

## Restrições

Não habilitar antes de integração, ensaios com RLS/FORCE, sessões concorrentes, mudanças de fuso/semana, paginação e revisão adversarial. A composição oficial exige provar cobertura e exclusão de deslocamento nas demais estimativas.
