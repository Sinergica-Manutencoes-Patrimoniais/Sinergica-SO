# Data Model — E01-S172

## Aggregates and Constraints

Disponibilidade por técnico/Cliente/vigência tem horas preventivas, reservas/ausências e especialidades/certificações/perfis. Projeção de capacidade não é livro de execução: HH interna/externa/acompanhamento/deslocamento separados; unidade duração total ou por unidade é explícita. Semana segunda–domingo e baseline original são consultáveis.

## State and history

### US1 — Comparar demanda e disponibilidade com mesma unidade

- AC-1: Dada duração por unidade, quando calcular, então HH = duração × técnicos × quantidade; tempo total do Sistema não multiplica quantidade outra vez, e OS/ocorrência ligadas contam só esforço restante uma vez.
- AC-2: Dada disponibilidade, quando consolidar, então usa horas realmente destinadas, desconta reservas/ausências configuradas, inclui deslocamento quando preenchido e mostra parâmetros; não presume jornada inteira preventiva.
- AC-3: Dado terceiro, quando consolidar, então separa execução externa de acompanhamento interno; somente acompanhamento Sinérgica consome equipe própria; zero/ausente mantém Demanda incompleta.

### US2 — Planejar por alerta consciente

- AC-4: Dada sobrecarga, conflito, ausência, perfil ou certificação, quando planejar, então mostra alerta e exige confirmação consciente/justificativa, mas permite continuar sem bloquear por esses alertas.
- AC-5: Dada capacidade aritmética suficiente mas equipe sem simultaneidade/especialidade, quando simular, então sinaliza incompatibilidade explicitamente; saldo HH não prova composição viável.
- AC-6: Dada reprogramação, quando comparar semanas, então mostra origem/destino e saldos antes de salvar, usa data programada ou vencimento na ausência, mantém baseline por vencimento e semana segunda–domingo inclusive virada anual.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
