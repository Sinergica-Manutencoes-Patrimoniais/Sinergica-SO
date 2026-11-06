# ADR-1434 — Tipo de tarefa na Rotina inicial migrada

Adicionar referência opcional ao cadastro existente de tipos de tarefa na Rotina. O registro de origem do ADR-1433 preenche a referência na Rotina de rascunho e incrementa a revisão do Plano na mesma transação. A aprovação existente fotografa a Rotina completa; nenhum snapshot aprovado é reescrito. Ausência continua desconhecida e não é preenchida por inferência.

Não muda a geração de OS nem cria tarefa Auvo. Antes de ativar: verificar efeitos de coluna nova em snapshots e hashes, cópia/revisão de versões, troca de alvo, referências inativas, validação de aprovação, concorrência, autorização, RLS/FORCE e revisão adversarial. O gate do ADR-1433 permanece fechado.
