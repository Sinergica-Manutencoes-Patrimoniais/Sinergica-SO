# ADR-1193 — Grupos no horizonte parcial

## Contexto

A fonte 0879 consolida estimativas conhecidas de Grupos por semana sem comprovar demanda total ou disponibilidade. Ela depende das fontes privadas 0454 e 0878, mantém três gates fechados e não tem entrada autenticada.

## Decisão

Preparar entrada mediada que confira ator, Cliente e capacidades, mantenha travas dos três gates e invoque o núcleo privado. A interface poderá consultar explicitamente o subtotal sob flag própria, sem misturá-lo ao total de OS, sem alegar saldo e sem supor que ausências de tempo sejam zero. Falhas da fonte de Grupos não devem esconder o horizonte básico.

## Limitações

Consulta pode percorrer até 10.000 fontes por semana; medir custo e duração, revisar locks, índices, RLS/FORCE, dados concorrentes, duplicidades e autorização antes de habilitar. Os gates não substituem fotografia transacional das fontes nem cobrem escritores que não respeitem a trava consultiva. Não aplicar ou homologar sem testes e revisão adversarial.
