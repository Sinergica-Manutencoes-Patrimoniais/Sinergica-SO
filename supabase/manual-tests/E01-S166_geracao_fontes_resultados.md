---
name: "supabase-manual-tests-e01-s166-geracao-fontes-resultados-md"
description: "Documento Sinérgica SO: S166 — geração contratual e fontes concorrentes"
alwaysApply: false
---

# S166 — geração contratual e fontes concorrentes

Em 30/10/2026 foram criados clones sintéticos em rede interna, sem portas ou
cron, restaurados do diagnóstico condicionado pelas seis correções temporárias
de migrations históricas. Fixture `E01-S166_geracao_fixture_sintetica.sql`
habilita os gates exclusivamente no clone e não deve ser usada em produção.

O teste dblink `E01-S166_geracao_fontes_concorrencia.sql` reproduziu 6/6
falhas com a mediação 1009: a geração aberta não bloqueava alteração de
concessão, quatro gates ou inserção de feriado. Com 1029 aplicada apenas no
clone, 12/12 verificações passaram nas duas ordens: geração primeiro segura
as seis fontes; fonte primeiro recusa geração enquanto alteração está aberta.
Ambas as transações testadas foram revertidas. Não comprova commit após espera,
desempenho sob carga ou todos os caminhos de escrita legados.

Em clone separado, com 1029, `E01-S166_acesso_geracao_visita.test.sql`
passou 19/19, incluindo replay, feriado já declarado, revogação e ausência de
OS/outbox; teste transacional revertido. Não significa homologação da story.

Conforme ADR-0841, trigger de feriados afeta todas as escritas nessa tabela
independentemente dos gates e usa chave global. Falta avaliar compatibilidade,
ordem de travas e contenção em todos os escritores e serviços, inclusive
operações sem geração. Não aplicar migration fora de clone descartável antes
dessas provas e revisão adversarial. Não houve deploy nem tarefa real Auvo.
