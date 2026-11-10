# Data Model — E01-S169

## Aggregates and Constraints

Lote de Plano referencia staging canônico E01-S178, arquivo/hash/mapeamento/versão, linhas e decisões. Mapeamento de escopo referencia cadastros existentes e Rotinas; inclui unidade real da periodicidade, base de duração e ciclo/datas de origem. Exportação lê snapshot de Versão e filtros, nunca deriva execução de programação.

## State and history

### US1 — Conferir e importar planos sem inventar dados

- AC-1: Dadas amostras, quando mapear, então oferece correspondências de cadastros existentes, disciplina separada de Sistema, erros por linha e revisão PCM antes da gravação; nenhuma OS/tarefa nasce só por importar.
- AC-2: Dado Rimini, quando aprovar, então preserva 59 registros e 25 tempos SPCI como Tempo a validar; 103 h conhecidas não incluem esforço pendente e 5,6 h não vira padrão universal.
- AC-3: Dado I Home, quando mapear, então preserva 53 registros, exclusões próprias e vigência 05/08/2026–28/07/2027; S01 do I Home e S31 do Rimini para mesma data não colidem; X é programação, nunca execução.
- AC-4: Dado lote repetido ou linha alterada, quando reprocessar, então apresenta novos/alterados/rejeitados e aprovação controlada sem duplicar Rotina/ciclo; premissa mensal quatro semanas da fonte exige mapeamento explícito para calendário real.

### US2 — Exportar versão e cronograma conferíveis

- AC-5: Dada Versão selecionada, quando exportar PDF/planilha, então identifica Cliente, vigência, versão, filtros, escopo, Rotinas, periodicidade e datas; inclusão de capacidade é explícita.
- AC-6: Dadas linhas retiradas, demanda incompleta ou feriado, quando exportar cronograma operacional, então mesmas regras do SO são usadas, distingue baseline/programado e não promete 52 Visitas após supressões.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
