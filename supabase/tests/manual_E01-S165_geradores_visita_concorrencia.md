# Geradores de Visita e legado concorrentes após revisão

Usar exclusivamente clone descartável isolado com migrations até 1728. Preparar `manual_E01-S165_visita_rascunho_aprovacao_1723.sql` até a linha anterior à substituição da função 1045, incluindo recursivamente os arquivos `\ir`. Confirmar apenas os dados sintéticos para permitir duas sessões.

Obter previamente a definição da função da guarda 1045 via `pg_get_functiondef`. Em transação, substituir temporariamente essa função, autenticar o ator sintético e chamar `pcm.sso_aprovar_revisao_mediada` conforme a fixture. Restaurar a definição original **antes do commit** e conferir sua igualdade depois. Somente no clone, aplicar a simulação de relógio presente na fixture de aprovação. Executar `pcm.sso_aplicar_retiradas_fila` para o Plano sintético e confirmar a retirada; não criar OS nem acionar Auvo.

Na sessão A autenticada como `16610000-0000-0000-0000-000000000001`, iniciar transação e chamar `pcm.sso_preparar_visita_canonica` com request `16610000-0000-0000-0000-000000000260`, Cliente `16610000-0000-0000-0000-00000000000a`, ocorrência `16610000-0000-0000-0000-000000000261`, Plano `16610000-0000-0000-0000-000000000121`, versão `16610000-0000-0000-0000-000000000181`, rotina lógica `16610000-0000-0000-0000-000000000124` na versão aprovada, Visita `16610000-0000-0000-0000-000000000083`, revisão 4 e fonte sintética. Manter a transação aberta após preparar.

Na sessão B autenticada, chamar `pcm.materializar_ocorrencias_preventivas` para o legado `16610000-0000-0000-0000-000000000930` até a primeira data do próprio legado. Confirmar A; caso B receba contenção, repetir após confirmação. Conferir uma ocorrência Visita preparada com o ID acima e nenhuma ocorrência legada no índice 0. Descartar o clone inteiro, incluindo relógio simulado.

Ensaio passou: B recebeu contenção, retry terminou e as contagens foram preservadas. Aprovação e relógio simulados não comprovam aprovação operacional, integração externa, demais decisões ou todos os escritores.
