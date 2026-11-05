# Exceção aprovada e mudança de dia concorrentes

Usar clone descartável isolado com migrations até 1732. Executar a preparação de `manual_E01-S166_excecao_aprovada_1732.sql` até a linha anterior ao comentário `GRANT apenas na transação de teste`. Conceder execute da RPC de exceção e habilitar seu gate **somente no clone**; confirmar a preparação sintética. A Visita regular `17320000-0000-0000-0000-000000000010` será a candidata à exceção; a Visita `...0001` permanece móvel.

Na primeira ordem, iniciar `pcm.sso_alterar_dia_com_visitas` com as duas Visitas na fotografia e manter a transação aberta. A RPC `pcm.sso_aprovar_excecao_visita` para a segunda deve receber `55P03`. Reverter mudança e repetir a aprovação: deve ser possível.

Na ordem inversa, iniciar aprovação da exceção e manter transação aberta; a alteração de dia deve receber `55P03`. Confirmar a exceção e executar alteração com fotografia contendo somente a Visita `...0001`: ela deve ser movida e a Visita excepcional deve manter data e revisão originais.

Para verificar ordem das travas, manter `LOCK TABLE pcm.sso_excecoes_visita_aprovadas IN SHARE MODE` em uma sessão e tentar a aprovação em outra: deve falhar com `55P03` antes de bloquear a linha de Visita; a alteração contratual subsequente na primeira sessão deve prosseguir. Reverter e descartar o clone.

As duas ordens e a contenção na versão final da 1732 passaram em clone; os dados eram sintéticos. Não executam integração ou tarefas Auvo e não medem carga em produção.
