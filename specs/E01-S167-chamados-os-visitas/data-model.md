# Data Model — E01-S167

## Aggregates and Constraints

pcm.chamados mantém necessidade e estado gerencial; pcm.ordens_servico.chamado_id é canônico N:1. Composição de escopo contém parcelas atendidas/restantes e referências de origem. OS de continuação referencia antecessora e escopo/esforço restante. UUID e números legados preservados; OS novas recebem referência pública única distinta da referência do Chamado (sufixo estável), sem colisão do unique numero. Vínculo singular legado é somente leitura compatível.

## State and history

### US1 — Dividir necessidade em várias OS rastreáveis

- AC-1: Dado Chamado, quando criar três OS com escopos diferentes, então todas pertencem ao mesmo contêiner e têm IDs/referências próprias; retry idêntico não duplica e comandos distintos são permitidos.
- AC-2: Dado quadro gerencial, quando visualizar Chamado com várias OS, então existe um único card por Chamado com progresso/OS internas; listas de OS conservam unidades executáveis e contexto Cliente.
- AC-3: Dados registros antigos, quando migrar leitura/escrita para ordens_servico.chamado_id, então UUIDs, números e links permanecem; campo singular não governa novas relações nem impede segunda OS.

### US2 — Continuar, suspender e encerrar sem perder escopo

- AC-4: Dada OS parcial, quando técnico sugerir trabalho/horas restantes e PCM revisar, então nova OS recebe somente restante, mantém vínculo com anterior e horas executadas nela; não duplica demanda futura.
- AC-5: Dadas todas OS encerradas mas parcela sem atendimento ou continuação ainda não criada, quando avaliar Chamado, então não fica apto; somente escopo integral e todas OS encerradas indicam aptidão, e encerramento exige ação PCM.
- AC-6: Dado Chamado suspenso/cancelado com motivo, quando devolver escopo, então somente não resolvido volta vinculado ao Backlog de E01-S174; execução e histórico permanecem e retorno/reabertura não apagam eventos anteriores.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
