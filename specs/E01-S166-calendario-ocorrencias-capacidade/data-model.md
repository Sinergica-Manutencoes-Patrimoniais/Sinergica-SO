# Data Model — E01-S166

## Aggregates and Constraints

pcm.regras_visita_contratual (Cliente, contrato, frequência, dia semanal, horas, deslocamento opcional, timezone, vigência); pcm.excecoes_calendario (origem, motivo, data, natureza, aprovação); Ocorrência guarda rotina lógica/versão, alvo, ciclo estável, vencimento original, programação, janela e validação. Unique de ciclo não usa apenas versão e não usa SNN da planilha. Snapshot de modo e tolerâncias preserva baseline.

## State and history

### US1 — Construir calendário válido antes de gerar

- AC-1: Dado modo por Visita e feriado no dia contratual, quando projetar semana, então não gera Visita nem ocorrência daquela Visita, capacidade nem indicador previsto/pendente/atrasado/dispensado/executado; somente auditoria de supressão.
- AC-2: Dado modo por calendário, quando vencimento mensal/anual/legal cair em feriado, então obrigação permanece pendente ao PCM; execução na semana seguinte não desloca próximo vencimento.
- AC-3: Dada mudança de dia fixo com vigência, quando aplicar, então só futuro não confirmado muda; mantém passado, extras, exceções aprovadas, reprogramações e IDs Auvo existentes; Visita extra pode coexistir na semana.

### US2 — Materializar ciclos e avaliar prazo sem duplicar

- AC-4: Dada âncora 31/01, quando calcular meses, então usa último dia em fevereiro e 31/03; intervalos dias/semanas/meses/anos são explícitos, execução antecipada/tardia não move âncora e vigência cruza anos.
- AC-5: Dado hoje 01/10 e janela padrão 30 dias inclusiva, quando materializar, então inclui 31/10 e exclui 01/11, cria por Rotina + alvo + ciclo uma ocorrência mesmo com duas sessões/retry/revisão; não cria tarefa Auvo.
- AC-6: Dada ativação/retomada, quando houver vencidos, então lista para decisão PCM sem geração retroativa em massa; ocorrências elegíveis entram em fila Preventivas Aguardando sem criticidade corretiva; cancelada não reaparece automaticamente.
- AC-7: Dadas tolerâncias antes/depois da Rotina, quando avaliar prazo, então zero é padrão e valores inteiros não negativos são independentes; tolerância não altera data-base; mudança de recorrência gera versão e mantém vencimento original separado da programação.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
