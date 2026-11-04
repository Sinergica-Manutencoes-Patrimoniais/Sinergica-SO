# ADR-0399 — Impedimento explícito na suspensão

Prepara-se comando privado que exige impedimento textual explícito além do motivo ao suspender Chamado, preservando revisões e transação do comando administrativo existente. Retomada não recebe impedimento. O impedimento fica vinculado ao evento e auditado; nenhuma conclusão de parada operacional é inferida.

A fonte atual não possui contrato canônico de anexo privado para evento de suspensão; não se interpreta URL ou anexo de outro domínio como evidência. Guarda transversal opcional nasce desligada e bloqueia suspensão legada sem o wrapper; retomada permanece inalterada. Compatibilidade, evidência privada, testes e revisão devem ser concluídos antes de ativar. Gates e execução fechados.
