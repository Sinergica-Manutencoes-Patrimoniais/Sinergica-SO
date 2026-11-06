# ADR-0270 — Alteração motivada de quantidade de Grupo

A edição integral já registra antes/depois da quantidade, mas não exige motivo. Prepara-se comando restrito que altera apenas quantidade, preserva identidade, Local, Sistema e características, exige motivo e revisão e registra auditoria com request id idempotente. A projeção de motivos do histórico reconhece também essa operação.

Gate e execução permanecem fechados. A edição integral anterior não é substituída; a aplicação de obrigatoriedade transversal depende de revisão de compatibilidade. Testes e revisão de concorrência são pré-requisitos de ativação.
