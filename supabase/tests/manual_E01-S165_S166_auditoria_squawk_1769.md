---
name: "supabase-tests-manual-e01-s165-s166-auditoria-squawk-1769-md"
description: "Documento Sinérgica SO: Auditoria Squawk das migrations até 1769"
alwaysApply: false
---

# Auditoria Squawk das migrations até 1769

Execução local de `pnpm exec squawk --assume-in-transaction --reporter json supabase/migrations/*.sql`: 474 alertas em 42 arquivos. Todos os 42 arquivos constam no snapshot remoto `origin/backup/sso-wip-20261104`; nenhum consta no HEAD local. Portanto são anteriores ao trabalho posterior ao snapshot, mas não se pode chamá-los de baseline da branch principal ou de migrations já aplicadas em produção sem verificar o ambiente.

S165/S166 concentram 415 alertas em oito arquivos: 404 são erros em cascata do parser em 0276 e 0345, iniciados nas constraints `EXCLUDE USING gist`; ambas já compilaram no PostgreSQL do clone histórico. Isso não prova ausência de outros problemas nos trechos que o parser não conseguiu analisar. Outros 11 alertas dizem respeito a FK e constraints que podem bloquear escritas ou leituras durante validação/criação de índices (0262, 0304, 0313, 0419 e 1501), e à retirada de `NOT NULL` em `preparada_id` (1719), mudança intencional para reservar ciclo ainda não preparado, que exige consumidores compatíveis com NULL.

Os demais 59 alertas pertencem a outras stories. As constraints e índices em tabelas existentes exigem análise de volume, tempo de lock e janela antes da aplicação real; a compilação em clone não mede esse impacto. O gate de CI varre todas as migrations e permanece sujeito a esses alertas. Não foi editada migration capturada no snapshot, desativada regra ou feita alteração em produção; uma migration posterior não elimina o lock da migration anterior.

## Análise dos 11 alertas por migration

| Migration | Alertas | Avaliação para rollout |
| --- | ---: | --- |
| 0262 | 1 FK | `rotinas_manutencao` nasce em 0261; `questionarios` pode conter dados anteriores. A adição referencia as duas tabelas e pode bloquear escritas; dados existentes das rotinas, se houver rollout parcial com operação, também precisam ser avaliados. |
| 0304 | 1 CHECK | `ocorrencias_preventivas` já existe em `origin/main` desde 0224 e pode ser volumosa. O CHECK em origem valida linhas sob lock; medir com dados representativos e controlar tempo de espera. A coluna recebe default constante, mas não se deve presumir que a validação do CHECK é gratuita. |
| 0313 | 6: 3 UNIQUE e 3 validações | Constrói constraints em `calendario_contratual_series`, `regras_visita_contratual` e `visitas`, criadas respectivamente em 0276/0282. UNIQUE pode bloquear leitura e escrita durante índice; essas tabelas podem estar vazias numa implantação inicial contínua, mas isso não é garantido se etapas forem aplicadas separadamente ou houver uso antecipado. |
| 0419 | 1 CHECK | Substitui regra de `plano_transicoes_historico`, criada em 0416. Varredura e lock dependem de volume; se já houver dados, a constraint nova exige todas as ações aceitas. |
| 1501 | 1 CHECK | Substitui regra da fila criada em 1494, aceitando `aguardando`, `verificacao` e `cancelado`. Pode bloquear/validar dados existentes se a implantação for parcial e já houver operação. |
| 1719 | 1 DROP NOT NULL | `preparada_id` torna-se opcional para reserva de ciclo futuro. Tabela criada em 1714 tem acesso direto revogado aos papéis de aplicação; a mudança é intencional, mas leitores/integrações privilegiados devem aceitar NULL. O teste isolado de banco não prova todos os consumidores externos. |

Uma migration 1770 executaria depois dos locks e da validação de 0262–1719: não evita esses riscos. Também não é seguro restaurar NOT NULL, pois isso quebraria a reserva futura especificada. Como os arquivos foram capturados no snapshot, não foram reescritos nem foi criada migration que apenas mascararia os alertas. Antes de qualquer rollout, conferir histórico efetivo do banco, volume, transações abertas e compatibilidade de consumidores; ensaiar a sequência com cópia representativa e combinar janela e limites operacionais apropriados. A única forma de alterar a própria estratégia DDL dessas etapas requer um plano de implantação compatível com o histórico efetivo, não uma correção posterior.
