# Data Model — E01-S179

## Aggregates and Constraints

pcm.listas_materiais referencia OS e Cliente obrigatórios, responsável Cliente/Sinérgica, texto_original imutável, estado e informação de disponibilidade. Linhas opcionais mantêm trecho de origem, descrição, quantidade/unidade explícitas ou pendentes e exceção. Estados levantada/aguardando aquisição/informada disponível/parcial/indisponível/dispensada/concluída; evento de campo reabre exceção sem criar OS substituta.

## State and history

### US1 — Organizar lista simples e revisável

- AC-1: Dada lista, quando cadastrar, então exige OS/Cliente, responsável, texto original e estado; Central filtra por Cliente/responsável/OS e abre contexto em Chamado/360.
- AC-2: Dado texto com linhas/marcadores e quantidade explícita, quando organizar sem IA, então gera linhas revisáveis; prosa ambígua fica intacta e não inventa produto/unidade/quantidade.
- AC-3: Dadas linhas organizadas, quando juntar/dividir/editar, então original permanece evidência e itemização é opcional; salvar texto simples continua possível.

### US2 — Controlar disponibilidade por informação e exceção

- AC-4: Dado responsável Cliente ou Sinérgica, quando informar disponibilidade, então registra autor/data e caráter informativo; não afirma conferência física nem exige confirmação item a item.
- AC-5: Dado material faltante/parcial/errado ou novo levantamento em campo, quando registrar, então reabre exceção com evidências e permite suspender/reprogramar mesma OS preservando tarefa Auvo e história.
- AC-6: Dada aquisição Sinérgica, quando encaminhar, então fornece vínculo à composição de orçamento E01-S181; material é fornecimento, não despesa da Visita e não gera faturável antes de evento elegível.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
