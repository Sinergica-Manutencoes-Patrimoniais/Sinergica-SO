# ADR 1348 — Preparação explícita de ciclo vencido

## Contexto

O materializador canônico existente limita vencimentos à data civil atual e aos 30 dias seguintes. A prévia de vencidos não consegue preparar uma obrigação anterior para tratamento do PCM.

## Decisão

Adicionar comando explícito para preparar um ciclo vencido até 366 dias antes da data civil da versão aprovada. O comando reutiliza o materializador canônico, sua identidade, autorização, snapshot, vigência, idempotência e guardas; não altera a data-base nem cria OS ou tarefa Auvo. Um gate separado inicia fechado. A exceção da janela só vale durante o comando, para a combinação exata de transação, ator, Plano, versão, Rotina e vencimento; chamadas comuns preservam a janela anterior. Repetições de pedido existente seguem verificações do comando canônico.

## Consequências

Versões que o materializador existente não permite gerar continuam bloqueadas; não se afirma que o ciclo esteja pendente ou sem execução externa. A alteração requer migração aditiva com conferência exata das definições existentes, ensaios de janela, idempotência, vigência, autorização, concorrência e segurança, e revisão adversarial antes de abrir gates. Não constitui fila automática nem cobre períodos mais antigos.
