# ADR-0687 — Mediação da conferência de levantamento

A conferência e o resumo de lote passam por funções mediadoras com execução concedida apenas a usuários autenticados. Cada mediadora exige o gate próprio desligado por padrão, identidade e autorização `cadastro.aprovar` para o Cliente efetivo do lote. O núcleo permanece sem concessão direta; o resumo não fica acessível por outro Cliente. A conferência mantém o gate, bloqueio, revisão otimista, retrato e idempotência do comando existente, na mesma transação e com a identidade original.

O navegador não recebe credenciais administrativas. A ativação depende de migrations, verificação do proprietário das funções e exposição do schema, testes de isolamento e concorrência, e revisão de segurança. A alteração não aprova lote nem incorpora cadastros.
