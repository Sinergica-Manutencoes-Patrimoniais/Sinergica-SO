# Data Model — E01-S165

## Aggregates and Constraints

pcm.planos_manutencao (identidade, cliente_id, proprietário, estado, versão vigente); pcm.plano_versoes (plano_id, número, vigência início/fim, aprovação, conteúdo congelado); pcm.rotinas_manutencao (identidade lógica, versão, alvo_tipo, alvo_id, modo, âncora, intervalo inteiro positivo, unidade dias/semanas/meses/anos, tolerância antes/depois inteiras não negativas com default 0, questionário ID externo e versão/snapshot de referência). Plano contém várias Rotinas; cada versão de Rotina possui exatamente um alvo do mesmo Cliente. Escopo Manter/Retirar exige motivo e vigência. Modelo aplicado por cópia identificada não altera planos existentes.

## State and history

Plano: Rascunho → Em revisão → Aprovado → Ativo → Suspenso/Encerrado; devolução de revisão volta a Rascunho, retomada de Suspenso volta a Ativo com decisão dos vencidos. Aprovado tem conteúdo imutável e só ativa na vigência definida. Encerrado fica somente consultável. Atualizar versão não copia execução para nova versão nem altera snapshot anterior.

### US1 — Elaborar Plano amplo sem efeito operacional

- AC-1: Dado rascunho do Cliente, quando adicionar vários Sistemas/Componentes/Grupos Quantitativos, então Plano mantém escopo amplo e cada Rotina exige um único alvo inequívoco do mesmo Cliente; seleção de outro Cliente é negada no servidor.
- AC-2: Dadas Rotinas mensal e semestral do mesmo alvo, quando salvar e simular, então permanecem independentes com instruções, periodicidades e tempos próprios; salvar, copiar ou importar rascunho não cria Ocorrência operacional, Chamado, OS ou tarefa.
- AC-3: Dado tempo vazio ou zero pendente, quando elaborar, então mostra Tempo a validar; duração total de Sistema e por unidade são distintas e capacidade não é declarada validada.

### US2 — Aprovar e revisar com histórico preservado

- AC-4: Dado Plano em revisão, quando gestor com concessão individual aprovar, então congela conteúdo e registra responsável/data; rascunho incompleto é recusado com erro por Rotina; criador autorizado pode autoaprovar.
- AC-5: Dada alteração de âncora, regra, alvo ou questionário de Rotina usada, quando revisar, então cria nova versão com vigência e prévia de ocorrências a manter/alterar e OS abertas, sem mudar snapshot histórico ou conteúdo em execução.
- AC-6: Dado modelo ou questionário Auvo referenciado, quando copiar/alterar fonte, então preserva ID, versão e conteúdo recebido do que foi usado; mudança não altera plano aprovado; publicar no Auvo permanece fechado sem prova de API.
- AC-7: Dado escopo retirado, suspensão ou encerramento, quando confirmar motivo/vigência, então interrompe geração elegível futura sem cancelar OS automaticamente, preserva consulta passada e retomada encaminha vencidos à decisão PCM.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
