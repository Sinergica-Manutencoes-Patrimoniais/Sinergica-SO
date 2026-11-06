# Data Model — E01-S178

## Aggregates and Constraints

Lote levantamento guarda origem/arquivo/hash/chave externa, revisão, Cliente e estado; linha contém tipo, código informado, atributos, referências por chave temporária, match sugerido e decisão. Evidências por linha usam Storage privado com origem. Aprovação resolve códigos definitivos pelo serviço E01-S177. Estados recebido/em conferência/pendente/aprovado parcial/aprovado/rejeitado com trilha e dependências de linha.

## State and history

### US1 — Receber e conferir sem alterar estrutura oficial

- AC-1: Dada planilha padronizada, quando receber, então staging lista campos faltantes, códigos inválidos, duplicidades, vínculos ausentes, hierarquia inconsistente e linhas novas/alteradas/rejeitadas antes de gravar estrutura oficial.
- AC-2: Dado levantamento Auvo provisório por tarefa/questionário padronizado, quando receber, então preserva respostas/fotos/origem como pendentes e reentrega não duplica; texto corrido não cria cadastro definitivo nem depende de interpretação automática.
- AC-3: Dado contrato futuro Campo, quando receber payload tipado com fotos/quantidades/observações, então usa mesma conferência; permite Local/Sistema provisório sem inventar código definitivo e coleta não é bloqueada por classificação incerta.

### US2 — Aprovar parcial e incorporar com identidade segura

- AC-4: Dado lote em conferência, quando PCM autorizado aprovar, então valida localização/classificação/vínculo/duplicidade separadamente, reserva códigos e só então incorpora às tabelas oficiais; acesso sem capacidade é negado.
- AC-5: Dado pai rejeitado ou referência pendente, quando aprovar parcial, então dependentes não entram silenciosamente; linhas válidas aprovadas permanecem e retorno mantém fotos, motivo e histórico.
- AC-6: Dadas aprovações concorrentes/retry/lote corrigido, quando processar, então revisão obsoleta conflita, mesmo registro não duplica e mudanças são rastreadas por lote/linha; reversão não apaga dependência operacional posterior.

## Integrity and persistence

Todo relacionamento é validado no servidor por Cliente/escopo e transação, não apenas no seletor. Revisão é inteiro não negativo e requestId UUID. Timestamps de evento em UTC; programação com timezone IANA quando houver Visita. Exclusão lógica onde há histórico. Auditoria append-only e correlação obrigatória. Constraints de identidade/origem são também constraints de banco; disputa de duas sessões deve terminar em resultado único ou conflito explícito, nunca sucesso parcial silencioso.

Migrations novas sequenciais com RLS FORCE, pgTAP permitido/negado. Reusar dados de dependências sem criar cópia concorrente. Ver ADR-0026/0027/0028 e contratos-programa.
